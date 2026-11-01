#!/usr/bin/env python3
"""Move base64 images embedded in HTML pages out into real image files next to the page.

usage: split-inline-images.py <folder> [min_kb=300]

GoDaddy/cPanel hosting runs ModSecurity, which inspects HTML responses and answers 500 Internal Server
Error when a page is bigger than its inspection limit. Pages like intro.html carried their title art
as multi-megabyte data: URIs, so they failed only on the live server. This rewrites each large page
to reference <page>-img-N.<ext> instead (identical images are written once). Run it on a game folder
before uploading; it is safe to run twice.
"""
import base64, hashlib, pathlib, re, sys
root = pathlib.Path(sys.argv[1]); min_bytes = int(sys.argv[2] if len(sys.argv) > 2 else 300) * 1024
pat = re.compile(r'data:image/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/=]+)')
for page in root.rglob('*.html'):
    if page.stat().st_size < min_bytes: continue
    text = page.read_text(encoding='utf-8'); names = {}
    def repl(m):
        ext = 'jpg' if m.group(1) == 'jpeg' else m.group(1)
        key = hashlib.sha1(m.group(2).encode()).hexdigest()
        if key not in names:
            names[key] = f'{page.stem}-img-{len(names) + 1}.{ext}'
            (page.parent / names[key]).write_bytes(base64.b64decode(m.group(2)))
        return names[key]
    new = pat.sub(repl, text)
    if new != text:
        page.write_text(new, encoding='utf-8')
        print(f'{page}: {len(text) // 1024} KB -> {len(new.encode()) // 1024} KB, images: {", ".join(names.values())}')
