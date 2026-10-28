"""Synthesize SFX tracks synced to each reel's scene timings and mux them into the MP4s.

Usage: python3 sfx.py <in_dir> <out_dir>
All sounds are generated here (no samples), so there is no copyright issue.
"""
import sys, os, wave, subprocess
import numpy as np

SR = 48000
rng = np.random.default_rng(7)


def env(n, a=0.004, d=None):
    t = np.arange(n) / SR
    e = np.minimum(1, t / a)
    if d:
        e *= np.exp(-t / d)
    return e


def pop(f0=900, f1=300, dur=0.09, vol=0.5):
    n = int(SR * dur)
    t = np.arange(n) / SR
    f = np.geomspace(f0, f1, n)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return vol * np.sin(ph) * env(n, 0.002, dur / 3.5)


def whoosh(dur=0.45, vol=0.35, up=True):
    n = int(SR * dur)
    noise = rng.standard_normal(n)
    # sweep a one-pole lowpass cutoff
    cut = np.geomspace(400, 6000, n) if up else np.geomspace(6000, 400, n)
    out = np.zeros(n)
    y = 0.0
    for i in range(n):
        a = 1 - np.exp(-2 * np.pi * cut[i] / SR)
        y += a * (noise[i] - y)
        out[i] = y
    shape = np.sin(np.pi * np.arange(n) / n) ** 1.5
    out = out / (np.abs(out).max() + 1e-9)
    return vol * out * shape


def ding(f=1320, dur=0.6, vol=0.32):
    n = int(SR * dur)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 2.0 * t) + 0.25 * np.sin(2 * np.pi * f * 3.01 * t)
    return vol * s / 1.75 * env(n, 0.003, 0.18)


def beep(f=1800, dur=0.08, vol=0.22):
    n = int(SR * dur)
    t = np.arange(n) / SR
    return vol * np.sign(np.sin(2 * np.pi * f * t)) * 0.5 * env(n, 0.002, 0.05)


def tick(vol=0.35):
    n = int(SR * 0.03)
    return vol * rng.standard_normal(n) * env(n, 0.0005, 0.006)


def swish(vol=0.3):
    return whoosh(0.22, vol, up=False)


def roll(dur=3.0, vol=0.08):
    """Soft motor hum for the robot."""
    n = int(SR * dur)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * 110 * t) * (0.6 + 0.4 * np.sin(2 * np.pi * 7 * t))
    fade = np.minimum(1, np.minimum(t / 0.3, (dur - t) / 0.3))
    return vol * s * fade


F = lambda frames: frames / 30.0

# (time_sec, sound) per reel. Times come from the <Sequence from=...> values in src/reels/*.tsx
EVENTS = {
    'R1': [(0.05, pop()), (F(75), whoosh()), (F(80), pop(1100, 500)), (F(195), whoosh()), (F(200), pop(1200, 550)),
           (F(315), whoosh()), (F(320), pop(1300, 600)), (F(435), whoosh()), (F(435 + 20), beep()), (F(435 + 40), beep()),
           (F(435 + 62), ding()), (F(555), whoosh(up=False)), (F(560), pop(700, 250, 0.14))],
    'R2': [(0.05, pop()), (F(75), whoosh()), (F(75 + 55), ding(1560)), (F(180), whoosh()), (F(182), roll(3.4)),
           (F(330), whoosh()), (F(330 + 15), pop(500, 900, 0.12)), (F(420), whoosh(up=False)), (F(425), pop(700, 250, 0.14))],
    'R3': [(0.05, pop()), (F(75), whoosh()), (F(78), pop(1000, 1400, 0.1)), (F(165), whoosh())]
          + [(F(165 + 10 + 18 * k), pop(500 + 180 * k, 300 + 120 * k, 0.08, 0.45)) for k in range(5)]
          + [(F(300), whoosh()), (F(306), ding(1175)), (F(450), whoosh(up=False)), (F(455), pop(700, 250, 0.14))],
    'R4': [(0.05, pop()), (F(18), swish(0.4)), (F(80), whoosh()), (F(84), pop(1100, 500)), (F(200), whoosh()),
           (F(204), pop(1200, 550)), (F(320), whoosh()), (F(324), pop(1300, 600)), (F(440), whoosh(up=False)), (F(445), pop(700, 250, 0.14))],
    'R5': [(0.05, pop()), (F(75), whoosh()), (F(80), beep(1500)), (F(195), whoosh()), (F(195 + 30), beep()), (F(195 + 34), beep()),
           (F(195 + 36), swish(0.35)), (F(315), whoosh()), (F(333), ding(1400)), (F(420), whoosh(up=False)), (F(425), pop(700, 250, 0.14))],
    'R6': [(0.05, pop())]
          + sum([[(F(75 + 90 * i), whoosh(0.3, 0.25)), (F(75 + 90 * i + 2), tick()), (F(75 + 90 * i + 5), tick())] for i in range(4)], [])
          + [(F(435), whoosh(up=False)), (F(440), pop(800, 400)), (F(525), whoosh()), (F(535), pop(1100, 600)),
             (F(543), pop(1250, 700)), (F(555), ding(1320))],
}


def build(key, duration):
    n = int(SR * duration)
    track = np.zeros(n)
    for t, snd in EVENTS[key]:
        i = int(t * SR)
        j = min(n, i + len(snd))
        if i < n:
            track[i:j] += snd[: j - i]
    peak = np.abs(track).max()
    if peak > 0.9:
        track *= 0.9 / peak
    return np.stack([track, track], axis=1)


def write_wav(path, data):
    pcm = (np.clip(data, -1, 1) * 32767).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def main(src, dst):
    os.makedirs(dst, exist_ok=True)
    for f in sorted(os.listdir(src)):
        if not f.endswith('.mp4'):
            continue
        key = f[:2]
        dur = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', os.path.join(src, f)]))
        wav = os.path.join(dst, f[:-4] + '.wav')
        write_wav(wav, build(key, dur))
        subprocess.check_call(['ffmpeg', '-y', '-loglevel', 'error', '-i', os.path.join(src, f), '-i', wav, '-map', '0:v', '-map', '1:a',
                               '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-shortest', '-movflags', '+faststart',
                               os.path.join(dst, f)])
        os.remove(wav)
        print('ok', f, f'{dur:.1f}s', len(EVENTS[key]), 'sfx')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
