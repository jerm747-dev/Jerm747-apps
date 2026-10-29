#!/usr/bin/env python3
"""Package GS Fighter (Android 1.0.17 APK) as a jerm747.games browser project.

usage: make-gsfighter-project.py <GS-Fighter-Android-x.apk> <out project folder>

The APK is a WebView wrapper: its assets/ folder is the complete browser game with the Android updates
(selection flow, arcade presentation, V-wave, HD portraits, jump frames, music deck, Parallax Run...).
This script:
- copies assets/ into the project folder and makes root paths (/images/..., /index.html) folder-relative;
- loads gs-browser-bridge.js before android.js on every page, standing in for the Android app so the
  APK's features switch on in a browser (GS MENU, staged selection, arcade opening, file exports);
- leaves the game code itself untouched.
"""
import pathlib, re, shutil, sys, zipfile

apk, out = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2]).resolve()
here = pathlib.Path(__file__).resolve().parent
TEXT = ('.html', '.js', '.css', '.json')
if out.exists(): shutil.rmtree(out)
out.mkdir(parents=True)
with zipfile.ZipFile(apk) as z:
    members = [m for m in z.infolist() if m.filename.startswith('assets/') and not m.is_dir()]
    for m in members:
        dst = out / m.filename[len('assets/'):]
        dst.parent.mkdir(parents=True, exist_ok=True)
        with z.open(m) as src, open(dst, 'wb') as w: shutil.copyfileobj(src, w, 1 << 20)
top = sorted({p.name for p in out.iterdir()}, key=len, reverse=True)
pat = re.compile(r"""(["'`(=,\s])/(%s)(?=[/"'`?#)\s,])""" % '|'.join(re.escape(t) for t in top))
changed = 0
for p in out.rglob('*'):
    if not p.is_file() or p.suffix not in TEXT: continue
    depth = len(p.relative_to(out).parts) - 1 if p.suffix == '.css' else 0
    t = p.read_text(encoding='utf-8')
    n = pat.sub(lambda m: m.group(1) + '../' * depth + m.group(2), t)
    if n != t: p.write_text(n, encoding='utf-8'); changed += 1
shutil.copy2(here / 'gs-browser-bridge.js', out / 'gs-browser-bridge.js')
pages = 0
for p in out.glob('*.html'):
    t = p.read_text(encoding='utf-8')
    # "← Fighters" links in the workshops and Parallax Run go to the game's own select screen.
    if 'href="/"' in t:
        t = t.replace('href="/"', 'href="index.html"'); p.write_text(t, encoding='utf-8')
    if '<script src="android.js"></script>' in t:
        t = t.replace('<script src="android.js"></script>', '<script src="gs-browser-bridge.js"></script><script src="android.js"></script>', 1)
        p.write_text(t, encoding='utf-8'); pages += 1
size = sum(p.stat().st_size for p in out.rglob('*') if p.is_file())
print(f'GS Fighter project: {len(members)} files, {size / 1e6:.1f} MB, {changed} files path-fixed, bridge on {pages} pages -> {out}')
