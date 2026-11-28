// ---------------------------------------------------------------------------
// Chrome-ийг ХАЙЖ олдог resolver.
// Зорилго: шинээр browser татахгүйгээр (0 MB, 0 MNT) системд байгаа Chrome-ыг
// дахин ашиглах. Локал macOS болон GitHub Actions (ubuntu) хоёуланд ажиллана.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CANDIDATES = [
  // 0) Хэрэглэгчийн заасан
  process.env.PUPPETEER_EXECUTABLE_PATH,
  process.env.CHROME_PATH,

  // 1) macOS
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',

  // 2) Linux / GitHub Actions runner
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/snap/bin/chromium',

  // 3) Windows (бонус)
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].filter(Boolean);

/** puppeteer cache дотроос (хэрэв татсан бол) chrome хайх. */
function fromPuppeteerCache() {
  const roots = [
    process.env.PUPPETEER_CACHE_DIR,
    path.join(os.homedir(), '.cache', 'puppeteer'),
    path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright'),
  ].filter(Boolean);

  const found = [];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const stack = [root];
    let guard = 0;
    while (stack.length && guard++ < 4000) {
      const dir = stack.pop();
      let entries;
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
          stack.push(full);
        } else if (
          e.name === 'Google Chrome for Testing' ||
          e.name === 'chrome-headless-shell' ||
          e.name === 'chrome' ||
          e.name === 'headless_shell'
        ) {
          found.push(full);
        }
      }
    }
  }
  return found;
}

function usable(p) {
  try {
    const st = fs.statSync(p);
    return st.isFile() && (st.mode & 0o111) !== 0;
  } catch {
    return false;
  }
}

/**
 * Ажиллах Chrome-ийн замыг буцаана.
 * @throws олдоогүй бол тодорхой заавартай error
 */
export function findChrome() {
  for (const p of CANDIDATES) {
    if (usable(p)) return p;
  }
  for (const p of fromPuppeteerCache()) {
    if (usable(p)) return p;
  }
  throw new Error(
    [
      'Chrome олдсонгүй.',
      '',
      'Шийдэл (аль нэгийг сонго):',
      '  1) macOS дээр Google Chrome суулга: https://www.google.com/chrome/',
      '  2) Эсвэл замыг нь өөрөө заа:',
      '     export PUPPETEER_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"',
      '  3) Эсвэл жижиг headless shell тат (~140MB):',
      '     npx @puppeteer/browsers install chrome-headless-shell@stable',
    ].join('\n'),
  );
}

/**
 * Хөнгөн тохиргоотой browser нэгж. 2015 MacBook / 8GB RAM-д тохируулсан:
 * GPU off, shared memory /tmp-д, extension/background процессгүй.
 */
export async function launch(puppeteer) {
  const executablePath = findChrome();
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    protocolTimeout: 180_000,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-sync',
      '--no-first-run',
      '--no-default-browser-check',
      '--hide-scrollbars',
      '--allow-file-access-from-files',
      '--mute-audio',
      '--font-render-hinting=none',
      '--force-color-profile=srgb',
    ],
  });
  return { browser, executablePath };
}
