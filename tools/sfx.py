"""Build audio/sfx.m4a: the recorded half of the game's sound effects, cut from public-domain (CC0) recordings on
Freesound, packed end to end into one small file, with the index the game reads in js/sfxpack.js.

Everything else (the crowd, the horn, the buzzer, the clank of the rim's steel, the menus) is made in code by
js/audio.js; these are the sounds that code makes badly: sneaker squeaks, the net, the ball on the floor and the
board, the referee's whistle.

Run (macOS, for afconvert):  python3 -m venv .sfx/venv && .sfx/venv/bin/pip install numpy
                             .sfx/venv/bin/python -I tools/sfx.py
The originals are downloaded once into .sfx/ (not part of the repository). Each cut is found from a rough window:
the loudest moment in it, back to 30 dB under that, forward until the sound has died by `drop` dB or reached
`maxlen`; then the DC is removed, a 3 ms fade in, a 60 ms fade out, and the peak set to -1 dB. Each clip starts on its
own half-second slot in the pack, so the game can find it by position even after AAC's encoder delay. """
import json
import os
import subprocess
import sys
import urllib.request
import wave

import numpy as np

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
CACHE = os.path.join(ROOT, '.sfx')
SR = 44100
SLOT = 0.5

# id: (Freesound page, preview), all CC0 1.0 (checked on each page, 2026-11-16)
SOURCES = {
    518048: ('https://freesound.org/people/Hann90/sounds/518048/', 'https://cdn.freesound.org/previews/518/518048_3663300-hq.mp3'),
    675319: ('https://freesound.org/people/craigsmith/sounds/675319/', 'https://cdn.freesound.org/previews/675/675319_2524442-hq.mp3'),
    88502: ('https://freesound.org/people/shakaharu/sounds/88502/', 'https://cdn.freesound.org/previews/88/88502_357009-hq.mp3'),
    505628: ('https://freesound.org/people/Blankened/sounds/505628/', 'https://cdn.freesound.org/previews/505/505628_6512859-hq.mp3'),
    811910: ('https://freesound.org/people/DigPro120/sounds/811910/', 'https://cdn.freesound.org/previews/811/811910_7414526-hq.mp3'),
    218318: ('https://freesound.org/people/SpliceSound/sounds/218318/', 'https://cdn.freesound.org/previews/218/218318_1480854-hq.mp3'),
}

# name: (source, window start, window end, maxlen, drop)
CUTS = {}
for i, (a, b) in enumerate([(0.15, .5), (.85, 1.2), (1.55, 2.0), (2.1, 2.55), (2.7, 3.25), (3.45, 3.8), (4.1, 4.65), (4.95, 5.6)]):
    CUTS[f'swish{i}'] = (518048, a, b, 0.5, 34)
for i, c in enumerate([2.2, 3.9, 5.5, 7.8, 9.5, 14.2, 17.5, 19.0]):   # 0.6 and 15.9 have a second hit in them
    CUTS[f'board{i}'] = (675319, c - 0.25, c + 0.9, 0.7, 40)
for i, c in enumerate([1.75, 2.1, 3.4, 4.6, 6.0, 7.0, 8.65, 9.1]):    # 7.7 is two squeaks at once
    CUTS[f'squeak{i}'] = (88502, c - 0.15, c + 0.3, 0.28, 18)
CUTS['bounce0'] = (505628, 0, 0.3, 0.25, 40)
for i, c in enumerate([0.3, 0.88, 1.42, 2.07, 2.68, 3.35, 4.03]):
    CUTS[f'bounce{i + 1}'] = (811910, c - 0.08, c + 0.25, 0.18, 26)
CUTS['whistle0'] = (218318, 0.05, 2.0, 1.1, 36)


def original(sid):
    os.makedirs(CACHE, exist_ok=True)
    wav = os.path.join(CACHE, f'{sid}.wav')
    if not os.path.exists(wav):
        mp3 = os.path.join(CACHE, f'{sid}.mp3')
        req = urllib.request.Request(SOURCES[sid][1], headers={'User-Agent': 'PocketBasketball-build'})
        with urllib.request.urlopen(req) as r, open(mp3, 'wb') as f:
            f.write(r.read())
        subprocess.run(['afconvert', '-f', 'WAVE', '-d', f'LEI16@{SR}', '-c', '1', mp3, wav], check=True)
    w = wave.open(wav)
    return np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(float) / 32768


def envelope(x, hop):
    return np.array([np.sqrt(np.mean(x[i:i + hop] ** 2) + 1e-12) for i in range(0, len(x) - hop, hop)])


def cut(sid, t0, t1, maxlen, drop):
    x = original(sid)
    seg = x[int(t0 * SR):int(t1 * SR)]
    hop = int(SR * 0.005)
    e = envelope(seg, hop)
    db = 20 * np.log10(e)
    pk = int(np.argmax(e))
    s = pk
    while s > 0 and db[s] > db[pk] - 30:
        s -= 1
    t = pk
    while t < len(e) - 1 and db[t] > db[pk] - drop and (t - s) * hop < maxlen * SR:
        t += 1
    y = seg[max(0, s * hop - int(0.004 * SR)):min(len(seg), t * hop + int(0.03 * SR))].copy()
    y -= y.mean()
    fi, fo = int(0.003 * SR), min(len(y) // 2, int(0.06 * SR))
    y[:fi] *= np.linspace(0, 1, fi)
    y[-fo:] *= np.linspace(1, 0, fo) ** 2
    return y * (0.89 / (np.abs(y).max() + 1e-9))


def main():
    clips, index, pos = [], {}, 0.0
    for name, (sid, a, b, maxlen, drop) in CUTS.items():
        y = cut(sid, a, b, maxlen, drop)
        slots = int(np.ceil((len(y) / SR + 0.05) / SLOT))
        pad = np.zeros(int(slots * SLOT * SR))
        pad[:len(y)] = y
        clips.append(pad)
        index[name] = [round(pos, 3), round(len(y) / SR, 3)]
        pos += slots * SLOT
    pack = np.concatenate(clips)
    os.makedirs(os.path.join(ROOT, 'audio'), exist_ok=True)
    tmp = os.path.join(CACHE, 'pack.wav')
    w = wave.open(tmp, 'w')
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((pack * 32767).astype(np.int16).tobytes()); w.close()
    out = os.path.join(ROOT, 'audio', 'sfx.m4a')
    subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', '-b', '64000', '-c', '1', tmp, out], check=True)
    with open(os.path.join(ROOT, 'js', 'sfxpack.js'), 'w') as f:
        f.write('/* Generated by tools/sfx.py: where each recorded effect sits in audio/sfx.m4a, [start, seconds]. */\n')
        f.write('window.PB = window.PB || {};\nPB.SFXPACK = ' + json.dumps(index, separators=(',', ':')) + ';\n')
    print(f'{len(index)} clips, {pos:.1f} s, {os.path.getsize(out) // 1024} kB -> audio/sfx.m4a')


if __name__ == '__main__':
    sys.exit(main())
