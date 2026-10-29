#!/usr/bin/env python3
"""Package Groove Squad Get Down (jerm747-player/public) as a jerm747.games project folder.

usage: make-getdown-project.py <jerm747-player repo> <out project folder> [extra-files.txt]

- Copies groove-squad-get-down.html -> index.html plus every asset it references.
- Rewrites root paths (/assets/, /images/, /groove-squad/, /game-sounds/) to folder-relative ones so the
  game runs from jerm747.games/projects/groove-squad-get-down/.
- Swaps the site account script for a local one: no subscriptions, all 40 fighters open, no server sync.
- Adds the arcade shim (local fullscreen, music button hidden, Ranked Run kept as a personal-best run).
"""
import json, pathlib, re, shutil, sys, hashlib

repo = pathlib.Path(sys.argv[1]).resolve(); pub = repo / 'public'
out = pathlib.Path(sys.argv[2]).resolve()
extra = pathlib.Path(sys.argv[3]).read_text().split() if len(sys.argv) > 3 else []
START = '/groove-squad-get-down.html'
TEXT = ('.html', '.js', '.css', '.json', '.mjs')
PREFIXES = ('assets', 'images', 'groove-squad', 'game-sounds')

ref = re.compile(r"""["'`(](/(?:[A-Za-z0-9_.@-]+/)*[A-Za-z0-9_.@-]+\.[A-Za-z0-9]{2,5})(?:\?[^"'`) ]*)?""")
dref = re.compile(r"""["'`](/(?:images|assets|groove-squad)/[A-Za-z0-9_./-]*/)""")
seen, dirs, todo = set(), set(), [START]
while todo:
    f = todo.pop()
    if f in seen: continue
    p = pub / f.lstrip('/')
    if not p.is_file(): continue
    if f != START and p.suffix in ('.html', '.php'): continue
    seen.add(f)
    if p.suffix in TEXT:
        t = p.read_text(errors='ignore')
        todo += [m.group(1) for m in ref.finditer(t)]
        dirs |= {m.group(1) for m in dref.finditer(t)}
# Folders the game builds file names for at runtime (e.g. `${id}-70/${id}-atlas.png`).
BIG = {'/images/groove-squad/'}
for d in dirs - BIG:
    p = pub / d.lstrip('/')
    if p.is_dir():
        seen |= {'/' + str(x.relative_to(pub)) for x in p.iterdir() if x.is_file()}
seen |= {e if e.startswith('/') else '/' + e for e in extra if (pub / e.lstrip('/')).is_file()}
seen.discard(START)

if out.exists(): shutil.rmtree(out)
out.mkdir(parents=True)

def rel(text, depth):
    up = '../' * depth
    def sub(m): return m.group(1) + up + m.group(2) + '/'
    return re.sub(r"""(["'`(=,\s])/(%s)/""" % '|'.join(PREFIXES), sub, text)

total = 0
for f in sorted(seen):
    src = pub / f.lstrip('/'); dst = out / f.lstrip('/')
    dst.parent.mkdir(parents=True, exist_ok=True)
    if src.suffix in TEXT:
        # JS/JSON paths resolve against the page; CSS url() resolves against the stylesheet.
        depth = len(pathlib.PurePosixPath(f).parts) - 2 if src.suffix == '.css' else 0
        dst.write_text(rel(src.read_text(encoding='utf-8'), depth), encoding='utf-8')
    else:
        shutil.copy2(src, dst)
    total += dst.stat().st_size

# Game sounds: the player build publishes these with content revisions; do the same here.
gs = repo / 'game-sounds'; gsd = out / 'game-sounds'; gsd.mkdir()
man = json.loads((gs / 'manifest.json').read_text())
for sid, s in man['sounds'].items():
    b = (gs / s['file']).read_bytes(); (gsd / s['file']).write_bytes(b)
    s['revision'] = hashlib.sha256(b).hexdigest()[:16]; total += len(b)
(gsd / 'manifest.json').write_text(json.dumps(man))

# Local account: everyone is a "subscriber" here, nothing talks to jerm747.com.
(out / 'assets/jerm747-account.js').write_text((pathlib.Path(__file__).parent / 'games-account.js').read_text())
shutil.copy2(pathlib.Path(__file__).parent / 'games-shim.js', out / 'assets/games-shim.js')

html = rel((pub / START.lstrip('/')).read_text(encoding='utf-8'), 0)
def swap(old, new, count=1):
    global html
    n = html.count(old)
    if n != count: sys.exit(f'make-getdown-project: expected {count} of {old[:80]!r}, found {n}')
    html = html.replace(old, new)
# The shim loads first so fetch/fullscreen are in place before the game starts.
swap('<head>', '<head><script src="assets/games-shim.js"></script>')
swap('<title>Jerm747 · Groove Squad Get Down</title>', '<title>Groove Squad Get Down · Jerm747.games</title>')
# Full screen button: the arcade has no music player to hand off to, so go full screen here.
swap("if(parent!==window){parent.postMessage({type:'jerm747-getdown-fullscreen'},location.origin);return;}", '')
# No subscriptions here: everyone has the full squad, so say so without "Subscriber" wording.
swap("'Subscriber · Full squad · All 40 Groove Squad fighters are yours.'", "'Full squad · All 40 Groove Squad fighters are open.'")
swap("'Open · all 40 are yours'", "'Open · all 40 fighters'")
swap("btn.title='Subscribers · 10 opponents, Jimmy Legend last · fastest clear ranks'", "btn.title='10 opponents, Jimmy Legend last · fastest clear ranks on this device'")
html = html.replace('Ranked Run · all subscribers', 'Ranked Run · best on this device')
(out / 'index.html').write_text(html, encoding='utf-8')
# Music lives in the jerm747.com player; send the library link there instead of this site's root.
gc = out / 'assets/game-console.js'
t = gc.read_text(encoding='utf-8')
if t.count("library.href='/'") != 1: sys.exit('make-getdown-project: music library link changed in game-console.js')
gc.write_text(t.replace("library.href='/'", "library.href='https://jerm747.com/'"), encoding='utf-8')
print(f'Get Down project: {len(seen) + 1} files, {total / 1e6:.1f} MB -> {out}')
