import json, html, os, shutil
from PIL import Image
OUT='/home/claude/site/public/download'
os.makedirs(OUT,exist_ok=True)
GAMES=[
 dict(slug='gs-fighter-3', title='GS Fighter III', version='1.3.0', file='GS-Fighter-III-v1.3.0.apk', size=181521444,
      sha='0457fcbac4338716fb3194abf6c0917bda4842fc23fcc0df88b757fc6218c3d3', date='November 1, 2026',
      shots=[('01-title','Title screen'),('02-fighter-select','Diamond Crest fighter select'),('03-matchup','Painted art for every fighter'),('04-player-menu','Player Menu'),('05-move-guide','Move Guide')],
      cover='/home/claude/work/gs3-cover.jpg', logo='/home/claude/work/gs3-logo.png', accent='#F2A33A', glow='#35c6e8',
      blurb='Fourteen fighters in full 3D. Version 1.3 adds the Player Menu: pause any match for fighter info, a Move Guide that plays every move with its inputs, and full Options. Plus a Training mode with a passive dummy and an endless clock.',
      points=['14 fighters on the painted Diamond Crest select','New Player Menu, Move Guide and Training mode','Controller rumble and phone vibration','CPU Easy → Ferocious · Arcade best of three'],
      note='<b>Have 1.2.0 installed?</b> Uninstall it first. 1.3.0 is signed with a new key, so Android won’t install it over the old one.'),
 dict(slug='gs-fighter-2', title='GS Fighter II', version='1.0.17', file='GS-Fighter-Android-1.0.17.apk', size=422387305,
      sha='21f50544cdc64e4aeece7ec99c449365ec6d60f1c448fff82df0bed3817f8568', date='',
      cover='/home/claude/work/gs2-cover.jpg', logo='/home/claude/work/gs2-logo.png', accent='#5B83F0', glow='#f2b437',
      blurb='The handheld edition. Fourteen featured fighters with HD portraits and cinematic intros, V-wave orbs, Parallax Run, the in-game music deck and the Sprite, Sound, Jump and V-wave workshops.',
      points=['14 featured fighters, HD portraits','Parallax Run with destructible boxes','Sprite, Sound, Jump and V-wave workshops','Controller, keyboard or touch'],
      note='The app may still say "GS Fighter" on its icon and title screen; it is the same game.'),
]
def gallery(g):
    if not g.get('shots'): return ''
    items=''.join(f'<a href="/projects/{g["slug"]}/screenshots/{n}.webp" target="_blank" rel="noopener"><img src="/projects/{g["slug"]}/screenshots/{n}-thumb.webp" alt="{html.escape(c)}" loading="lazy" width="480" height="270"></a>' for n,c in g['shots'])
    return f'<div class="box shots"><h2>Screenshots</h2><div class="shot-row">{items}</div></div>'
def mb(n): return f'{n/1e6:.0f} MB'
CSS='''
:root{--bg:#07080d;--panel:#11131d;--line:#262a3b;--ink:#f3ecdf;--mute:#9aa0b5;--f-d:"Chakra Petch","Arial Narrow",sans-serif;--f-b:"IBM Plex Sans",system-ui,sans-serif;color-scheme:dark}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 var(--f-b)}
a{color:inherit}
.top{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px max(16px,4vw);font:600 14px var(--f-d);letter-spacing:.08em;text-transform:uppercase}
.top a{text-decoration:none;color:var(--mute)}.top a:hover{color:var(--ink)}.top b{color:var(--ink)}
.hero{position:relative;overflow:hidden;isolation:isolate;min-height:min(62vh,560px);display:grid;place-items:center;padding:40px 16px 30px}
.hero::before{content:"";position:absolute;inset:0;background:var(--cover) center/cover;filter:blur(8px) saturate(1.15) brightness(.45);z-index:-2;transform:scale(1.08)}
.hero::after{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at 50% 45%,transparent 30%,var(--bg) 92%),linear-gradient(transparent 55%,var(--bg));z-index:-1}
.hero img{width:min(560px,86vw);height:auto;filter:drop-shadow(0 12px 40px #000c)}
main{max-width:980px;margin:-40px auto 0;padding:0 16px 60px;position:relative}
.card{background:linear-gradient(180deg,#151827,var(--panel));border:1px solid var(--line);border-radius:18px;padding:clamp(18px,4vw,34px);box-shadow:0 30px 80px #000a}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 10px}.chip{font:600 12px var(--f-d);letter-spacing:.08em;text-transform:uppercase;padding:4px 10px;border-radius:99px;border:1px solid var(--line);color:var(--mute)}
.chip.a{border-color:var(--accent);color:var(--accent)}
h1{font:700 clamp(30px,6vw,48px)/1.05 var(--f-d);margin:0 0 10px;letter-spacing:.01em}
.blurb{color:#d9d3c7;max-width:62ch;margin:0 0 22px}
.actions{display:flex;flex-wrap:wrap;gap:10px;margin:0 0 8px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;min-height:50px;padding:12px 20px;border-radius:12px;border:1px solid var(--line);background:#1b1f30;font:700 16px var(--f-d);letter-spacing:.05em;text-transform:uppercase;text-decoration:none;cursor:pointer;color:var(--ink)}
.btn:hover{border-color:var(--mute)}.btn:focus-visible{outline:3px solid var(--glow);outline-offset:2px}
.btn.primary{background:linear-gradient(180deg,var(--accent),color-mix(in srgb,var(--accent) 70%,#000));border-color:transparent;color:#140c02;box-shadow:0 8px 30px color-mix(in srgb,var(--accent) 35%,transparent)}
.btn svg{flex:none}.meta{color:var(--mute);font-size:14px;margin:6px 0 0}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px;margin-top:22px}
.box{border:1px solid var(--line);border-radius:14px;padding:18px 20px;background:#0d0f17}
.box h2{font:700 15px var(--f-d);letter-spacing:.1em;text-transform:uppercase;margin:0 0 10px;color:var(--glow)}
.box ul,.box ol{margin:0;padding-left:20px}.box li{margin:4px 0}.small{font-size:13.5px;color:var(--mute)}
details{margin-top:10px}summary{cursor:pointer;color:var(--mute);font-size:14px}code{font:12.5px ui-monospace,Menlo,monospace;word-break:break-all;color:#cfd6ea}
.others{margin-top:26px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;color:var(--mute);font-size:14px}
.others a{border:1px solid var(--line);border-radius:10px;padding:8px 12px;text-decoration:none}.others a:hover{border-color:var(--mute);color:var(--ink)}
.toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#1d2234;border:1px solid var(--line);padding:10px 16px;border-radius:10px;opacity:0;transition:opacity .2s;pointer-events:none}.toast.on{opacity:1}
.list{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}
.tile{display:block;text-decoration:none;border:1px solid var(--line);border-radius:16px;overflow:hidden;background:var(--panel)}.tile:hover{border-color:var(--mute)}
.tile img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover}.tile div{padding:14px 16px}.tile b{font:700 20px var(--f-d)}.tile span{display:block;color:var(--mute);font-size:14px}

.shots{margin-top:18px}.shot-row{display:flex;gap:10px;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:4px}
.shot-row a{flex:none;width:min(240px,66vw);border-radius:10px;overflow:hidden;border:1px solid var(--line);scroll-snap-align:start}
.shot-row img{display:block;width:100%;height:auto;aspect-ratio:16/9;object-fit:cover}
footer{color:var(--mute);font-size:13px;text-align:center;padding:10px 16px 40px}
'''
open(f'{OUT}/download.css','w').write(CSS.strip()+'\n')
DL='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M5 20h14"/></svg>'
PLAY='<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4v16l13-8z"/></svg>'
SHARE='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>'
HEAD='''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{title}</title><meta name="description" content="{desc}">
<meta property="og:type" content="website"><meta property="og:title" content="{title}"><meta property="og:description" content="{desc}">
<meta property="og:url" content="{url}"><meta property="og:image" content="{img}"><meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#07080d"><link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@600;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="{css}"></head>'''
SCRIPT='''<script>
(() => {
  const btn = document.getElementById('share'), toast = document.getElementById('toast');
  const show = t => { toast.textContent = t; toast.classList.add('on'); setTimeout(() => toast.classList.remove('on'), 2200); };
  btn.addEventListener('click', async () => {
    const data = { title: document.title, text: btn.dataset.text, url: btn.dataset.url };
    if (navigator.share) { try { await navigator.share(data); return; } catch (e) { if (e.name === 'AbortError') return; } }
    try { await navigator.clipboard.writeText(data.url); show('Link copied'); }
    catch { prompt('Copy this link:', data.url); }
  });
})();
</script>'''
for g in GAMES:
    d=f"{OUT}/{g['slug']}"; os.makedirs(d,exist_ok=True)
    Image.open(g['cover']).convert('RGB').save(f'{d}/share.jpg',quality=86)
    Image.open(g['logo']).save(f'{d}/logo.webp',quality=90,method=6)
    url=f"https://jerm747.games/download/{g['slug']}/"
    others=''.join(f'<a href="../{o["slug"]}/">{o["title"]} APK</a>' for o in GAMES if o is not g)
    desc=f"Download {g['title']} {g['version']} for Android, or play it free in your browser at jerm747.games."
    page=HEAD.format(title=f"{g['title']} for Android · Download APK · jerm747.games",desc=html.escape(desc),url=url,img=url+'share.jpg',css='../download.css')+f'''
<body style="--accent:{g['accent']};--glow:{g['glow']}">
<nav class="top"><a href="/"><b>JERM747</b>.GAMES</a><a href="../">All downloads</a></nav>
<header class="hero" style="--cover:url('/download/{g['slug']}/share.jpg')"><img src="logo.webp" width="900" height="{Image.open(g['logo']).height}" alt="{g['title']}"></header>
<main><section class="card">
<p class="chips"><span class="chip a">Android APK</span><span class="chip">Version {g['version']}</span><span class="chip">{mb(g['size'])}</span></p>
<h1>{g['title']}</h1>
<p class="blurb">{g['blurb']}</p>
<div class="actions">
<a class="btn primary" href="{g['file']}" download>{DL} Download APK</a>
<a class="btn" href="/#/play/{g['slug']}">{PLAY} Play in browser</a>
<button class="btn" id="share" type="button" data-url="{url}" data-text="{html.escape(g['title'])} for Android, free from Jerm747">{SHARE} Share</button>
</div>
<p class="meta">{g['file']} · {mb(g['size'])}{' · ' + g['date'] if g['date'] else ''} · Android phones and tablets</p>
<div class="grid">
<div class="box"><h2>What you get</h2><ul>{''.join(f'<li>{p}</li>' for p in g['points'])}</ul></div>
<div class="box"><h2>Install on Android</h2><ol>
<li>Tap <b>Download APK</b> and let it finish (it’s a large file, so Wi-Fi helps).</li>
<li>Open the file from your notifications or the Downloads app.</li>
<li>If Android asks, allow <b>Install unknown apps</b> for your browser or Files app, then tap <b>Install</b>.</li>
</ol><p class="small">{g['note']} The APK comes straight from Jerm747, not the Play Store, so Play Protect may ask you to confirm.</p>
<details><summary>File check (SHA-256)</summary><code>{g['sha']}</code></details></div>
</div>
{gallery(g)}
<p class="others">Also available: {others}</p>
</section></main>
<footer>Jerm747 original. All rights reserved. · <a href="/">jerm747.games</a></footer>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
{SCRIPT}
</body></html>
'''
    open(f'{d}/index.html','w').write(page)
# index
tiles=''.join(f'<a class="tile" href="{g["slug"]}/"><img src="{g["slug"]}/share.jpg" alt="" loading="lazy"><div><b>{g["title"]}</b><span>Android APK · {g["version"]} · {mb(g["size"])}</span></div></a>' for g in GAMES)
idx=HEAD.format(title='Downloads · jerm747.games',desc='Android downloads of GS Fighter III and GS Fighter II by Jerm747.',url='https://jerm747.games/download/',img='https://jerm747.games/download/gs-fighter-3/share.jpg',css='download.css')+f'''
<body style="--accent:#F2A33A;--glow:#35c6e8">
<nav class="top"><a href="/"><b>JERM747</b>.GAMES</a><a href="/">Play in browser</a></nav>
<main style="margin-top:20px"><h1>Android downloads</h1><p class="blurb">Install the GS Fighter games on your Android phone or tablet. Each one also plays free in the browser at jerm747.games.</p>
<div class="list">{tiles}</div></main>
<footer>Jerm747 original. All rights reserved.</footer></body></html>
'''
open(f'{OUT}/index.html','w').write(idx)
print('ok')
