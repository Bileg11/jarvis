#!/usr/bin/env python3
# ══════════════════════════════════════════════════════════════════
# JARVIS VOICE — локал TTS сервер
# ══════════════════════════════════════════════════════════════════
# Jarvis-ийн хариуг монголоор ЧАНГААР уншина.
#
# 2 провайдер, нэг л тохиргоогоор солигдоно:
#   edge   — Microsoft edge-tts. Үнэгүй, хязгааргүй. Хоолой: Батаа / Есүй
#   eleven — ElevenLabs. ӨӨРИЙН хоолой (voice clone). API key хэрэгтэй.
#
# Ажиллуулах:   ./start.sh      (эсвэл .venv/bin/python server.py)
# Шалгах:       curl http://127.0.0.1:7788/health
#
# Зөвхөн 127.0.0.1 дээр сонсоно — гаднаас хандах боломжгүй.
import asyncio
import hashlib
import json
import os
import re
import sys
import urllib.request
import urllib.error
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs, unquote

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE_DIR = os.path.join(HERE, 'cache')
ENV_FILE = os.path.join(HERE, '.env')

HOST = '127.0.0.1'
PORT = int(os.environ.get('JARVIS_VOICE_PORT', '7788'))
MAX_CHARS = 1500

# ── .env унших (KEY=value, # тайлбар) ────────────────────────────
def load_env():
    if not os.path.exists(ENV_FILE):
        return
    with open(ENV_FILE, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            k, v = line.split('=', 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

load_env()

PROVIDER = os.environ.get('JARVIS_VOICE_PROVIDER', 'edge').lower()
ELEVEN_KEY = os.environ.get('ELEVENLABS_API_KEY', '')
ELEVEN_VOICE_ID = os.environ.get('ELEVENLABS_VOICE_ID', '')
ELEVEN_MODEL = os.environ.get('ELEVENLABS_MODEL', 'eleven_v3')


def parse_voice_map(raw):
    """'нэр:ID,нэр:ID' → {нэр: ID}"""
    out = {}
    for part in (raw or '').split(','):
        part = part.strip()
        if ':' not in part:
            continue
        name, vid = part.split(':', 1)
        name, vid = name.strip().lower(), vid.strip()
        if name and vid:
            out[name] = vid
    return out


ELEVEN_VOICES = parse_voice_map(os.environ.get('ELEVENLABS_VOICES', ''))
if ELEVEN_VOICE_ID and not ELEVEN_VOICES:
    ELEVEN_VOICES['default'] = ELEVEN_VOICE_ID
# Анхдагч: ELEVENLABS_VOICE_ID, байхгүй бол жагсаалтын эхнийх
ELEVEN_DEFAULT_ID = ELEVEN_VOICE_ID or (next(iter(ELEVEN_VOICES.values()), ''))

# ElevenLabs-ийн түүхий voice ID (20 тэмдэгт)
RAW_VOICE_ID_RE = re.compile(r'^[A-Za-z0-9]{20}$')


def resolve_eleven_voice(voice_key):
    """Нэр → ID, эсвэл түүхий ID-г шууд, эсвэл анхдагч."""
    k = (voice_key or '').strip()
    if k.lower() in ELEVEN_VOICES:
        return ELEVEN_VOICES[k.lower()]
    if RAW_VOICE_ID_RE.match(k):
        return k
    return ELEVEN_DEFAULT_ID

# ── Хоолойнууд ───────────────────────────────────────────────────
EDGE_VOICES = {
    'bataa': 'mn-MN-BataaNeural',   # эр
    'yesui': 'mn-MN-YesuiNeural',   # эм
}
EDGE_DEFAULT = 'bataa'

RATE_RE = re.compile(r'^[+-]\d{1,3}%$')
PITCH_RE = re.compile(r'^[+-]\d{1,3}Hz$')

# ══════════════════════════════════════════════════════════════════
# ТЕКСТ ЦЭВЭРЛЭХ — Jarvis-ийн хариунд markdown, emoji, JSON ордог.
# Тэдгээрийг чангаар уншвал утгагүй болно.
# ══════════════════════════════════════════════════════════════════
EMOJI_RE = re.compile(
    '[\U0001F300-\U0001FAFF\U00002190-\U000021FF\U00002300-\U000027BF'
    '\U00002B00-\U00002BFF\U0001F000-\U0001F2FF️‍]+'
)

def clean_for_speech(text: str) -> str:
    t = text or ''
    t = re.sub(r'```[\s\S]*?```', ' ', t)          # код блок
    t = re.sub(r'`([^`]*)`', r'\1', t)             # inline код
    t = re.sub(r'!\[[^\]]*\]\([^)]*\)', ' ', t)    # зураг
    t = re.sub(r'\[([^\]]*)\]\([^)]*\)', r'\1', t)  # холбоос — текстийг нь үлдээнэ
    t = re.sub(r'https?://\S+', ' ', t)            # нүцгэн URL
    t = re.sub(r'^\s{0,3}#{1,6}\s*', '', t, flags=re.M)  # гарчиг #
    t = re.sub(r'\*\*([^*]*)\*\*', r'\1', t)       # **тод**
    t = re.sub(r'(?<!\w)\*([^*\n]+)\*(?!\w)', r'\1', t)  # *налуу*
    t = re.sub(r'^\s*[-*•]\s+', '', t, flags=re.M)  # жагсаалтын цэг
    t = re.sub(r'^\s*\|.*\|\s*$', ' ', t, flags=re.M)  # хүснэгтийн мөр
    t = re.sub(r'^\s*[-:| ]{4,}\s*$', ' ', t, flags=re.M)  # хүснэгтийн зураас
    t = EMOJI_RE.sub(' ', t)
    t = re.sub(r'[*_#>~]', ' ', t)
    t = re.sub(r'[ \t]+', ' ', t)
    t = re.sub(r'\n{2,}', '\n', t)
    t = '\n'.join(ln.strip() for ln in t.split('\n'))
    return t.strip()


def looks_like_json(text: str) -> bool:
    """Зөвхөн JSON action ирсэн бол уншихгүй."""
    t = (text or '').strip()
    if not t.startswith('{'):
        return False
    try:
        json.loads(t)
        return True
    except Exception:
        return False


# ══════════════════════════════════════════════════════════════════
# ПРОВАЙДЕР 1 — edge-tts (үнэгүй)
# ══════════════════════════════════════════════════════════════════
async def _edge_bytes(text, voice, rate, pitch):
    import edge_tts
    comm = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
    buf = bytearray()
    async for chunk in comm.stream():
        if chunk.get('type') == 'audio' and chunk.get('data'):
            buf.extend(chunk['data'])
    return bytes(buf)


def edge_tts_bytes(text, voice_key, rate, pitch):
    voice = EDGE_VOICES.get(voice_key, EDGE_VOICES[EDGE_DEFAULT])
    return asyncio.run(_edge_bytes(text, voice, rate, pitch))


# ══════════════════════════════════════════════════════════════════
# ПРОВАЙДЕР 2 — ElevenLabs (ӨӨРИЙН хоолой)
# ══════════════════════════════════════════════════════════════════
def eleven_tts_bytes(text, voice_id=None):
    if not ELEVEN_KEY:
        raise RuntimeError('ELEVENLABS_API_KEY тавигдаагүй (.env файлд нэм)')
    vid = voice_id or ELEVEN_DEFAULT_ID
    if not vid:
        raise RuntimeError('ElevenLabs хоолой тохируулаагүй — .env дотор ELEVENLABS_VOICES эсвэл ELEVENLABS_VOICE_ID нэм')
    url = 'https://api.elevenlabs.io/v1/text-to-speech/%s?output_format=mp3_44100_128' % vid
    body = json.dumps({
        'text': text,
        'model_id': ELEVEN_MODEL,
    }).encode('utf-8')
    req = urllib.request.Request(url, data=body, method='POST', headers={
        'xi-api-key': ELEVEN_KEY,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
    })
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        detail = e.read().decode('utf-8', 'replace')[:400]
        # Байнга тохиолддог тохиолдлуудыг монголоор тайлбарлана
        if e.code == 402 or 'paid_plan_required' in detail:
            raise RuntimeError(
                'ElevenLabs: үнэгүй эрхээр API-гаар хоолой ашиглах боломжгүй. '
                'Вэб дээр нь ажиллана, API-д төлбөртэй багц хэрэгтэй. '
                'Одоохондоо .env дотор JARVIS_VOICE_PROVIDER=edge болго.')
        if e.code == 401:
            raise RuntimeError('ElevenLabs: API key буруу эсвэл эрх дутуу '
                               '(key дээр Text to Speech = Access эсэхийг шалга).')
        if e.code == 404:
            raise RuntimeError('ElevenLabs: voice ID олдсонгүй — .env доторх ID-г шалга.')
        if e.code == 422:
            raise RuntimeError('ElevenLabs 422: загвар эсвэл текст тохирсонгүй. '
                               'ELEVENLABS_MODEL-ийг eleven_multilingual_v2 болгож үзээрэй. '
                               + detail[:160])
        raise RuntimeError('ElevenLabs %s: %s' % (e.code, detail))


# ══════════════════════════════════════════════════════════════════
# КЭШ — ижил текстийг дахин үүсгэхгүй (хурдан + ElevenLabs-д мөнгө хэмнэнэ)
# ══════════════════════════════════════════════════════════════════
def cache_path(key: str) -> str:
    return os.path.join(CACHE_DIR, key + '.mp3')


def synth(text, provider, voice_key, rate, pitch):
    """→ (mp3_bytes, from_cache)"""
    vkey = resolve_eleven_voice(voice_key) if provider == 'eleven' else (voice_key or '')
    sig = '|'.join([provider, vkey, rate, pitch, ELEVEN_MODEL, text])
    key = hashlib.sha256(sig.encode('utf-8')).hexdigest()[:40]
    path = cache_path(key)
    if os.path.exists(path) and os.path.getsize(path) > 0:
        with open(path, 'rb') as f:
            return f.read(), True

    if provider == 'eleven':
        audio = eleven_tts_bytes(text, resolve_eleven_voice(voice_key))
    else:
        audio = edge_tts_bytes(text, voice_key, rate, pitch)

    if not audio:
        raise RuntimeError('Дуу үүсээгүй (хоосон хариу)')
    os.makedirs(CACHE_DIR, exist_ok=True)
    tmp = path + '.tmp'
    with open(tmp, 'wb') as f:
        f.write(audio)
    os.replace(tmp, path)
    return audio, False


# ══════════════════════════════════════════════════════════════════
# HTTP
# ══════════════════════════════════════════════════════════════════
ALLOWED_ORIGINS = {
    'http://localhost:5500', 'http://127.0.0.1:5500',
    'http://localhost:8080', 'http://127.0.0.1:8080',
    'http://localhost:3000', 'http://127.0.0.1:3000',
    'https://jarvis.amarsaikhanbileg.workers.dev',
    'https://lfsshanghai.com',
    'https://www.lfsshanghai.com',
}


def cors_origin(origin: str) -> str:
    if origin in ALLOWED_ORIGINS:
        return origin
    if re.match(r'^https?://(localhost|127\.0\.0\.1)(:\d+)?$', origin or ''):
        return origin
    return 'null'


class Handler(BaseHTTPRequestHandler):
    server_version = 'JarvisVoice/1.0'
    protocol_version = 'HTTP/1.1'

    def log_message(self, fmt, *args):
        sys.stderr.write('  %s\n' % (fmt % args))

    # ── CORS ─────────────────────────────────────────────────────
    def _cors(self):
        origin = self.headers.get('Origin', '')
        self.send_header('Access-Control-Allow-Origin', cors_origin(origin))
        self.send_header('Vary', 'Origin')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        # Chrome: HTTPS хуудаснаас localhost руу хандахад шаардана
        if self.headers.get('Access-Control-Request-Private-Network'):
            self.send_header('Access-Control-Allow-Private-Network', 'true')

    def _json(self, obj, status=200):
        body = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def _audio(self, data, cached):
        self.send_response(200)
        self.send_header('Content-Type', 'audio/mpeg')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('X-Jarvis-Cache', 'hit' if cached else 'miss')
        self.send_header('Cache-Control', 'no-store')
        self._cors()
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.send_header('Content-Length', '0')
        self.end_headers()

    def do_GET(self):
        u = urlparse(self.path)
        if u.path == '/health':
            return self._json({
                'ok': True,
                'provider': PROVIDER,
                'voices': list(EDGE_VOICES.keys()),
                'eleven_voices': sorted(ELEVEN_VOICES.keys()),
                'eleven_ready': bool(ELEVEN_KEY and ELEVEN_DEFAULT_ID),
                'port': PORT,
            })
        if u.path == '/tts':
            q = parse_qs(u.query)
            return self._handle_tts({
                'text': unquote(q.get('text', [''])[0]),
                'voice': q.get('voice', [''])[0],
                'provider': q.get('provider', [''])[0],
                'rate': q.get('rate', [''])[0],
                'pitch': q.get('pitch', [''])[0],
            })
        return self._json({'error': 'not found'}, 404)

    def do_POST(self):
        u = urlparse(self.path)
        if u.path != '/tts':
            return self._json({'error': 'not found'}, 404)
        try:
            n = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            n = 0
        if n <= 0 or n > 200000:
            return self._json({'error': 'body хэтэрхий том эсвэл хоосон'}, 400)
        try:
            payload = json.loads(self.rfile.read(n).decode('utf-8'))
        except Exception:
            return self._json({'error': 'JSON биш body'}, 400)
        return self._handle_tts(payload if isinstance(payload, dict) else {})

    # ── Гол логик ────────────────────────────────────────────────
    def _handle_tts(self, p):
        raw = (p.get('text') or '')[:MAX_CHARS * 4]
        if looks_like_json(raw):
            return self._json({'error': 'skip', 'reason': 'JSON action — уншихгүй'}, 422)

        text = clean_for_speech(raw)[:MAX_CHARS]
        if not text:
            return self._json({'error': 'skip', 'reason': 'уншихаар текст үлдсэнгүй'}, 422)

        provider = (p.get('provider') or PROVIDER).lower()
        if provider not in ('edge', 'eleven'):
            provider = 'edge'

        voice = (p.get('voice') or '').strip()
        if provider == 'edge' and voice not in EDGE_VOICES:
            voice = EDGE_DEFAULT

        rate = (p.get('rate') or '+0%').strip()
        pitch = (p.get('pitch') or '+0Hz').strip()
        if not RATE_RE.match(rate):
            rate = '+0%'
        if not PITCH_RE.match(pitch):
            pitch = '+0Hz'

        try:
            audio, cached = synth(text, provider, voice, rate, pitch)
        except Exception as e:
            sys.stderr.write('  ✗ TTS алдаа: %s\n' % e)
            return self._json({'error': str(e)}, 502)
        return self._audio(audio, cached)


def main():
    os.makedirs(CACHE_DIR, exist_ok=True)
    srv = ThreadingHTTPServer((HOST, PORT), Handler)
    srv.daemon_threads = True
    print('')
    print('  🔊 JARVIS VOICE')
    print('  ─────────────────────────────────────────')
    print('  Хаяг      : http://%s:%d' % (HOST, PORT))
    print('  Провайдер : %s' % PROVIDER)
    print('  Хоолой    : %s' % ', '.join(EDGE_VOICES))
    print('  ElevenLabs: %s' % (
        ('бэлэн — ' + ', '.join(sorted(ELEVEN_VOICES)) if (ELEVEN_KEY and ELEVEN_DEFAULT_ID)
         else 'тохируулаагүй')))
    print('  Кэш       : %s' % CACHE_DIR)
    print('  ─────────────────────────────────────────')
    print('  Зогсоох: Ctrl+C')
    print('')
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print('\n  Зогсов.')
        srv.shutdown()


if __name__ == '__main__':
    main()
