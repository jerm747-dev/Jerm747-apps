#!/usr/bin/env python3
"""Rebuild the GS Fighter III APK around a new web build.

usage: build_apk.py <base.apk> <web folder> <out.apk> <versionName> <versionCode> <keystore> <alias> <storepass>

The GS Fighter III APK is a small native WebView launcher (lib/*/libgsf.so) that opens
file:///android_asset/index.html. This keeps the launcher, manifest, icon and libraries from the
base APK, replaces assets/ with the web folder, sets the version, signs (v1/JAR, same as the base)
and 4-byte aligns stored entries.
"""
import os, struct, subprocess, sys, tempfile, zipfile, zlib
base, web, out, vname, vcode, ks, alias, pw = sys.argv[1:9]; vcode = int(vcode)
sys.path.insert(0, os.path.dirname(__file__)); import axml

def patch_manifest(b):
    b = bytearray(b); strings, elems = axml.parse(bytes(b))
    for a in elems[0][1]:
        if a['name'] == 'versionCode':
            struct.pack_into('<I', b, a['pos'] + 16, vcode)
        if a['name'] == 'versionName':
            s, p, l, enc = strings[a['raw']]
            assert enc == 'u16' and len(vname) == l, f'versionName must stay {l} chars (was {s})'
            b[p:p + 2 * l] = vname.encode('utf-16-le')
    return bytes(b)

STORE = ('.png', '.webp', '.jpg', '.jpeg', '.gif', '.mp3', '.ogg', '.wav', '.glb', '.arsc')
tmp = tempfile.mkdtemp(); unsigned = os.path.join(tmp, 'unsigned.apk')
with zipfile.ZipFile(base) as zb, zipfile.ZipFile(unsigned, 'w') as z:
    def add(name, data):
        zi = zipfile.ZipInfo(name, (2026, 11, 1, 0, 0, 0))
        zi.compress_type = zipfile.ZIP_STORED if name.lower().endswith(STORE) else zipfile.ZIP_DEFLATED
        z.writestr(zi, data, compresslevel=9)
    for e in zb.infolist():
        if e.filename.startswith(('META-INF/', 'assets/')) or e.is_dir(): continue
        data = zb.read(e)
        add(e.filename, patch_manifest(data) if e.filename == 'AndroidManifest.xml' else data)
    n = 0
    for root, _, files in os.walk(web):
        for f in sorted(files):
            p = os.path.join(root, f); add('assets/' + os.path.relpath(p, web).replace(os.sep, '/'), open(p, 'rb').read()); n += 1
print('assets:', n)
subprocess.run(['jarsigner', '-sigalg', 'SHA256withRSA', '-digestalg', 'SHA-256', '-keystore', ks, '-storepass', pw,
                '-sigfile', 'GSF', unsigned, alias], check=True, capture_output=True)

# zipalign -p 4 equivalent: copy every entry's raw bytes, padding the local header's extra field for stored entries.
def align(src, dst):
    data = open(src, 'rb').read()
    eocd = data.rfind(b'PK\x05\x06'); cd_size, cd_off = struct.unpack_from('<II', data, eocd + 12)
    count = struct.unpack_from('<H', data, eocd + 10)[0]
    outb = bytearray(); cd = bytearray(); p = cd_off
    for _ in range(count):
        (sig, vm, vn, fl, meth, t, d, crc, csz, usz, nl, el, cl, dn, ia, ea, lho) = struct.unpack_from('<IHHHHHHIIIHHHHHII', data, p)
        name = data[p + 46:p + 46 + nl]; cext = data[p + 46 + nl:p + 46 + nl + el]; comm = data[p + 46 + nl + el:p + 46 + nl + el + cl]
        lnl, lel = struct.unpack_from('<HH', data, lho + 26)
        raw = data[lho + 30 + lnl + lel: lho + 30 + lnl + lel + csz]
        new_off = len(outb); extra = b''
        if meth == 0:
            pad = (-(new_off + 30 + nl)) % 4; extra = b'\0' * pad
        outb += struct.pack('<IHHHHHIIIHH', 0x04034b50, vn, fl & ~0x08, meth, t, d, crc, csz, usz, nl, len(extra)) + name + extra + raw
        cd += struct.pack('<IHHHHHHIIIHHHHHII', sig, vm, vn, fl & ~0x08, meth, t, d, crc, csz, usz, nl, el, cl, dn, ia, ea, new_off) + name + cext + comm
        p += 46 + nl + el + cl
    cdo = len(outb); outb += cd
    outb += struct.pack('<IHHHHIIH', 0x06054b50, 0, 0, count, count, len(cd), cdo, 0)
    open(dst, 'wb').write(outb)
align(os.path.join(tmp, 'unsigned.apk'), out)
r = subprocess.run(['jarsigner', '-verify', out], capture_output=True, text=True); print(r.stdout.strip().splitlines()[-1])
