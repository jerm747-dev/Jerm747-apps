#!/usr/bin/env python3
"""End-to-end test for shared pages (api/shares_lib.php + a share folder) on PHP's built-in server.

Usage:  python3 tests/shares.integration.py [path/to/share-folder]
The share folder defaults to tests/fixtures/share (any folder made by build-release.py works).
Never sends real email: mail() is pointed at a file. Everything runs in a temp directory.
"""
import base64, json, os, pathlib, shutil, socket, subprocess, sys, tempfile, time, urllib.error, urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
PHP = os.environ.get('PHP_BIN', 'php')
SHARE_SRC = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'tests/fixtures/share'
SHARE = 'console-test01'
ADMIN_PW = 'test-admin-password-123'   # disposable test fixture
UA = {'alice': 'Mozilla/5.0 (Windows NT 10.0) Chrome/130.0', 'bob': 'Mozilla/5.0 (iPhone) Safari/605.1'}

passed = 0
def check(cond, label):
    global passed
    if not cond: raise AssertionError(label)
    passed += 1; print('  ok ', label)

def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k): return None

def get(url, user=None, cookie=None, headers=None):
    h = dict(headers or {})
    if user:
        h['Authorization'] = 'Basic ' + base64.b64encode(f'{user}:pw'.encode()).decode()
        h['User-Agent'] = UA[user]
    else:
        h.setdefault('User-Agent', UA['alice'])
    if cookie: h['Cookie'] = cookie
    req = urllib.request.Request(url, headers=h)
    try: r = urllib.request.build_opener(NoRedirect).open(req)
    except urllib.error.HTTPError as e: r = e
    return r.status, r.headers, r.read()

with tempfile.TemporaryDirectory(prefix='shares-test-') as td:
    temp = pathlib.Path(td); public = temp / 'public'
    shutil.copytree(ROOT / 'public/api', public / 'api', ignore=shutil.ignore_patterns('data'))
    (public / 'api/data').mkdir()
    shutil.copytree(SHARE_SRC, public / 'sites' / SHARE)
    mailbox = temp / 'mail.txt'
    catcher = temp / 'sendmail.sh'
    catcher.write_text(f'#!/bin/sh\n{{ echo "=====MAIL====="; cat; }} >> "{mailbox}"\n'); catcher.chmod(0o755)
    port = free_port(); base = f'http://127.0.0.1:{port}'
    srv = subprocess.Popen([PHP, '-d', f'sendmail_path={catcher}', '-S', f'127.0.0.1:{port}', '-t', str(public)],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    mails = lambda: [m for m in mailbox.read_text().split('=====MAIL=====') if m.strip()] if mailbox.exists() else []
    subject = lambda m: base64.b64decode(next(l for l in m.splitlines() if l.startswith('Subject:')).split('?B?')[1].split('?=')[0]).decode()
    try:
        for _ in range(50):
            try: urllib.request.urlopen(base + '/api/admin.php?action=status'); break
            except Exception: time.sleep(0.1)
        page = f'{base}/sites/{SHARE}/'
        admin = lambda q: json.loads(get(f'{base}/api/admin.php?{q}', headers={'X-Admin-Password': ADMIN_PW})[2])
        def admin_post(fields):
            body = '&'.join(f'{k}={urllib.request.quote(str(v))}' for k, v in fields.items()).encode()
            req = urllib.request.Request(base + '/api/admin.php', data=body, headers={'X-Admin-Password': ADMIN_PW, 'Content-Type': 'application/x-www-form-urlencoded'})
            return json.loads(urllib.request.urlopen(req).read())
        req = urllib.request.Request(base + '/api/admin.php', data=json.dumps({'action': 'setup', 'password': ADMIN_PW}).encode(), headers={'Content-Type': 'application/json'})
        urllib.request.urlopen(req)

        print('Visits and email')
        st, h, body = get(page, user='alice')
        check(st == 200 and b'Download the build' in body, 'page loads for a signed-in visitor')
        check('no-store' in h.get('Cache-Control', ''), 'page is not cached')
        check(len(mails()) == 1 and 'opened for the first time' in subject(mails()[0]), 'first visit emails you once')
        check('Signed in as: alice' in mails()[0], 'email names the sign-in user')
        get(page, user='bob')
        check(len(mails()) == 1, 'second visit sends no extra email')
        get(page, cookie='j747_nocount=1')
        sh = admin('action=shares')['shares']
        check(len(sh) == 1 and sh[0]['stats']['visits'] == 2, 'your own visit (nocount cookie) is not counted')

        print('Downloads')
        st, h, body = get(f'{page}get.php?f=wasvc-v0.2.0.zip', user='bob')
        check(st == 200 and body[:2] == b'PK' and 'attachment' in h.get('Content-Disposition', ''), 'build downloads as an attachment')
        check(len(mails()) == 2 and 'first download' in subject(mails()[1]) and 'wasvc-v0.2.0.zip' in mails()[1], 'first download emails you')
        get(f'{page}get.php?f=Application-Console-One-Pager-v0.2.0.pptx', user='alice')
        check(len(mails()) == 2, 'later downloads stay quiet by default')
        for bad in ['../../api/lib.php', '..%2F..%2Fapi%2Flib.php', '.htaccess', 'page.html', '', 'nope.zip']:
            check(get(f'{page}get.php?f={bad}', user='alice')[0] == 404, f'refuses f={bad or "(empty)"}')

        print('Console')
        st, h, _ = get(f'{page}go.php', user='alice')
        check(st == 302 and h['Location'] == 'console/', 'Open the console is logged, then redirects')
        st, _, body = get(f'{page}console/', user='alice')
        check(st == 200 and b'WASVC_VERSION' in body, 'console loads')

        print('Admin view')
        s = admin('action=shares')['shares'][0]
        check((s['stats']['visits'], s['stats']['downloads'], s['stats']['console']) == (2, 2, 1), 'counts: 2 visits, 2 downloads, 1 console open')
        check(s['stats']['people'] == 2, 'two different people')
        check({u['name'] for u in s['stats']['users']} == {'alice', 'bob'}, 'sign-in names listed')
        check(s['days_left'] in (29, 30) and s['active'] and s['title'] == 'Application Console v0.2.0', 'title and 30-day removal date')
        check(s['recent'][0]['type'] == 'console', 'recent activity newest first')
        if os.environ.get('DUMP_SHARES'): pathlib.Path(os.environ['DUMP_SHARES']).write_text(json.dumps(admin('action=shares')['shares'], indent=1))

        print('Controls')
        s = admin_post({'action': 'share', 'id': SHARE, 'op': 'notify', 'notify_downloads': '1'})['share']
        check(s['notify_downloads'] is True, 'turn on every-download emails')
        get(f'{page}get.php?f=wasvc-v0.2.0.zip', user='alice')
        check(len(mails()) == 3 and 'had a download' in subject(mails()[2]), 'every-download email arrives')
        s = admin_post({'action': 'share', 'id': SHARE, 'op': 'extend', 'days': '30'})['share']
        check(s['days_left'] in (59, 60), 'extend adds 30 days')
        admin_post({'action': 'share', 'id': SHARE, 'op': 'takedown'})
        check(all(get(u, user='alice')[0] == 410 for u in [page, f'{page}get.php?f=wasvc-v0.2.0.zip', f'{page}go.php', f'{page}console/']),
              'taken down: page, downloads and console all answer 410')
        check(b'no longer available' in get(page, user='alice')[2], 'taken-down page explains itself')
        admin_post({'action': 'share', 'id': SHARE, 'op': 'restore'})
        check(get(page, user='alice')[0] == 200, 'put back up')
        try:
            admin_post({'action': 'share', 'id': SHARE, 'op': 'nonsense'}); check(False, 'unknown op refused')
        except urllib.error.HTTPError as e:
            check(e.code == 400, 'unknown change refused')

        print('Removal reminder')
        cfg = public / f'api/data/shares/{SHARE}.json'
        c = json.loads(cfg.read_text()); c['expires'] = '2020-01-01T00:00:00+00:00'; cfg.write_text(json.dumps(c))
        before = len(mails())
        s = admin('action=shares')['shares'][0]
        check(s['due'] and len(mails()) == before + 1 and 'Reminder: take down' in subject(mails()[-1]), 'reminder emails once the date passes')
        admin('action=shares'); get(page, user='alice')
        check(len(mails()) == before + 1, 'reminder is sent only once')
        preview = admin_post({'action': 'report_test'})['preview']
        check('Shared pages' in preview and 'Application Console v0.2.0' in preview, 'traffic report lists shared pages')

        print('Without the site api/ folder')
        lone = temp / 'lone'; shutil.copytree(public / 'sites' / SHARE, lone / 'sites' / SHARE)
        p2 = free_port()
        srv2 = subprocess.Popen([PHP, '-S', f'127.0.0.1:{p2}', '-t', str(lone)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            for _ in range(50):
                try: urllib.request.urlopen(f'http://127.0.0.1:{p2}/sites/{SHARE}/'); break
                except Exception: time.sleep(0.1)
            st, _, body = get(f'http://127.0.0.1:{p2}/sites/{SHARE}/')
            check(st == 200 and b'Download the build' in body, 'page still works without tracking')
            check(get(f'http://127.0.0.1:{p2}/sites/{SHARE}/get.php?f=wasvc-v0.2.0.zip')[0] == 200, 'downloads still work without tracking')
        finally:
            srv2.terminate()
    finally:
        srv.terminate()

print(f'\nAll {passed} share checks passed.')
