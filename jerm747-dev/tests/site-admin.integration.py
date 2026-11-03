#!/usr/bin/env python3
"""Exercise the real PHP API in an isolated temporary site; never sends email.

Usage: PHP_BIN=/path/to/php python3 tests/site-admin.integration.py
All credentials below are disposable test fixtures, not production credentials.
"""
import copy, http.cookiejar, json, os, pathlib, shutil, socket, subprocess, tempfile, time, urllib.request, urllib.error

ROOT = pathlib.Path(__file__).resolve().parents[1]
PHP = os.environ.get('PHP_BIN', 'php')

class Client:
    def __init__(self, base):
        self.base, self.csrf = base, ''
        self.jar = http.cookiejar.CookieJar()
        self.open = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))
    def call(self, action, data=None, status=200, csrf=True, origin=None):
        headers={'Content-Type':'application/json'}
        if csrf: headers['X-Site-Admin-CSRF']=self.csrf
        if origin: headers['Origin']=origin
        req=urllib.request.Request(self.base+'?action='+action,data=json.dumps(data).encode() if data is not None else None,headers=headers)
        try: response=self.open.open(req)
        except urllib.error.HTTPError as e: response=e
        raw=response.read()
        try: result=json.loads(raw)
        except json.JSONDecodeError: raise AssertionError((action,response.status,raw.decode(errors='replace')))
        assert response.status == status, (action, response.status, status, result)
        if 'user' in result: self.csrf=result['user']['csrf']
        return result

with tempfile.TemporaryDirectory(prefix='returnity-admin-test-') as td:
    temp=pathlib.Path(td); public=temp/'public'; site=public/'sites/nige-hood'; private=public/'api/data'; private.mkdir(parents=True)
    shutil.copytree(ROOT/'public/site-admin',public/'site-admin')
    shutil.copytree(ROOT/'public/sites/nige-hood/admin',site/'admin')
    for file in ['site.config.json','tracks.json']: shutil.copy(ROOT/'public/sites/nige-hood'/file,site/file)
    instance=site/'admin/instance.php'
    instance.write_text(instance.read_text().replace("'mailMode' => 'mail'", "'mailMode' => 'capture'"))
    # Give the bootstrap owner the same kind of hash as the existing dev portal.
    digest=subprocess.check_output([PHP,'-n','-r',"echo password_hash('TestOwnerPass-2026', PASSWORD_DEFAULT);"]).decode()
    (private/'admin.json').write_text(json.dumps({'hash':digest}))
    # Two independently configured sites demonstrate that cookies and state do not cross.
    other=public/'sites/other'; shutil.copytree(site,other)
    other_instance=other/'admin/instance.php'
    other_instance.write_text(other_instance.read_text().replace("'id' => 'returnity'", "'id' => 'other'").replace('/sites/nige-hood','/sites/other').replace('site-admin/returnity','site-admin/other'))
    router=temp/'router.php'; router.write_text("<?php if (str_starts_with(parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH), '/api/data/')) {http_response_code(403);exit;} return false;")
    sock=socket.socket(); sock.bind(('127.0.0.1',0)); port=sock.getsockname()[1]; sock.close()
    log=open(temp/'php.log','w+')
    server=subprocess.Popen([PHP,'-n','-S',f'127.0.0.1:{port}','-t',str(public),str(router)],stdout=log,stderr=log)
    try:
        base=f'http://127.0.0.1:{port}/sites/nige-hood/admin/api.php'
        for _ in range(100):
            try: urllib.request.urlopen(base+'?action=catalog'); break
            except urllib.error.URLError: time.sleep(.03)
        guest=Client(base); owner=Client(base); nige=Client(base); old_owner=Client(base)
        guest.call('state',status=401)
        guest.call('login',{'username':'jeremy','password':'wrong'},401)
        owner.call('login',{'username':'jeremy','password':'TestOwnerPass-2026'})
        old_owner.call('login',{'username':'jeremy','password':'TestOwnerPass-2026'})
        cookie=next(iter(owner.jar)); assert cookie.has_nonstandard_attr('HttpOnly') and cookie.path=='/sites/nige-hood/admin/'
        catalog=owner.call('state')['catalog']; assert catalog['songs']==[]
        owner.call('save-catalog',{'catalog':catalog,'revision':0},403,csrf=False)
        owner.call('save-catalog',{'catalog':catalog,'revision':0},403,origin='https://attacker.example')
        # New songs inherit explicit/type flags in every public catalog response.
        def song(id, **kw): return {'id':id,'title':id,'url':f'audio/{id}.mp3','artists':['Nige Hood'],'album':'returnity','kind':'vocal','explicit':False,'published':True,**kw}
        catalog.update(songs=[song('clean'),song('explicit',explicit=True),song('beat',kind='instrumental'),song('draft',published=False)],albums=[{'id':'returnity','title':'Returnity','artist':'Nige Hood','cover':'','color':'#e2ad4f'}],playlists=[{'id':'mix','title':'Mix','trackIds':['explicit','clean','draft','beat']}])
        saved=owner.call('save-catalog',{'catalog':catalog,'revision':0})['catalog']; assert saved['revision']==1
        owner.call('save-catalog',{'catalog':catalog,'revision':0},409)
        p=guest.call('catalog'); assert [s['id'] for s in p['tracks']]==['clean','beat']; assert p['playlists'][0]['trackIds']==['clean','beat']
        p=guest.call('catalog&explicit=1&types=vocal'); assert [s['id'] for s in p['tracks']]==['clean','explicit']
        assert guest.call('catalog&types=')['tracks']==[]
        saved['policy']['explicit']='blocked'; saved=owner.call('save-catalog',{'catalog':saved,'revision':1})['catalog']
        assert [s['id'] for s in guest.call('catalog&explicit=1')['tracks']]==['clean','beat']
        for url in ['javascript:alert(1)','audio/../admin/instance.php','audio/%2e%2e/admin/instance.php','https://user:pass@example.com/song.mp3']:
            bad=copy.deepcopy(saved); bad['songs'][0]['url']=url; owner.call('save-catalog',{'catalog':bad,'revision':2},400)
        bad=copy.deepcopy(saved);bad['playlists'][0]['trackIds']=['missing'];owner.call('save-catalog',{'catalog':bad,'revision':2},400)
        # Account activation is one-time, role-scoped and invalidates prior sessions.
        invite=owner.call('invite',{'username':'nige','name':'Nige'}); token=invite['activationUrl'].split('#activate=')[1]
        nige.call('activate',{'token':token,'password':'short'},400)
        nige.call('activate',{'token':token,'password':'NigeTestPassword-2026'})
        nige.call('activate',{'token':token,'password':'NigeTestPassword-2026'},400)
        nige.call('login',{'username':'nige','password':'NigeTestPassword-2026'})
        assert nige.call('session')['user']['role']=='admin'
        nige.call('invite',{'username':'intruder','name':'No'},403)
        nige.call('users',status=404)
        saved=nige.call('save-catalog',{'catalog':saved,'revision':2})['catalog']
        assert saved['changes'][0]['actor']=='Nige'
        owner.call('disable-user',{'username':'nige'}); nige.call('state',status=401)
        # Passwords containing leading/trailing spaces survive hashing and login unchanged.
        owner.call('password',{'current':'TestOwnerPass-2026','password':' NewOwnerPassword-2026 '})
        old_owner.call('state',status=401)
        owner.call('logout',{}); owner.call('login',{'username':'jeremy','password':' NewOwnerPassword-2026 '})
        assert not owner.call('session')['user']['usesOwnerPassword']
        other_client=Client(f'http://127.0.0.1:{port}/sites/other/admin/api.php'); other_client.jar=owner.jar; other_client.open=owner.open
        other_client.call('state',status=401)
        assert other_client.call('catalog')['tracks']==[]
        # Scan only local music/audio; no symlinks outside site. New tracks remain drafts.
        (site/'audio').mkdir(); (site/'audio/new track.mp3').write_bytes(b'test')
        (site/'audio/outside.mp3').symlink_to(private/'admin.json')
        scanned=owner.call('scan')['songs']; assert len(scanned)==1 and not scanned[0]['published'] and scanned[0]['url']=='audio/new%20track.mp3'
        # Aggregates contain song IDs/day counts, not network or personal data.
        guest.call('play',{'id':'clean'}); guest.call('play',{'id':'draft'},404)
        reports=owner.call('state')['reports']; assert not reports['enabled'] and not reports['to']
        owner.call('save-reports',{'reports':{**reports,'enabled':True},'revision':0},400)
        reports.update(to=['owner@example.test'],enabled=True,frequency='daily',time='09:00')
        reports=owner.call('save-reports',{'reports':reports,'revision':0})['reports']; assert reports['nextAt']>time.time()
        owner.call('save-reports',{'reports':reports,'revision':0},409)
        preview=owner.call('preview'); assert '1 measured play in' in preview['text'] and 'clean: 1' in preview['text']
        r=owner.call('test-report',{}); assert r['captured'] and r['ok']
        data=private/'site-admin/returnity'; assert len(list(data.glob('test-mail-*.html')))==1
        # A due slot is claimed once, and a disabled schedule does not send.
        report_file=data/'reports.json'; r=json.loads(report_file.read_text()); r['nextAt']=int(time.time())-5; report_file.write_text(json.dumps(r))
        cron=[PHP,'-n',str(site/'admin/cron.php')]
        assert json.loads(subprocess.check_output(cron))['captured']
        assert json.loads(subprocess.check_output(cron))=={'due':False}
        assert len(list(data.glob('test-mail-*.html')))==2
        r=json.loads(report_file.read_text());r['nextAt']=int(time.time())-5;r['enabled']=False;report_file.write_text(json.dumps(r))
        assert json.loads(subprocess.check_output(cron))=={'due':False}
        try: urllib.request.urlopen(base.replace('api.php','cron.php')); assert False
        except urllib.error.HTTPError as e: assert e.code==404
        users_raw=(data/'users.json').read_text(); assert 'NigeTestPassword' not in users_raw and 'NewOwnerPassword' not in users_raw and token not in users_raw
        assert 'hash' not in json.dumps(owner.call('users'))
        # Correct local send hour across the March DST change, plus weekly day calculation.
        fixture=temp/'schedule.php'; core=public/'site-admin/core.php'
        fixture.write_text("<?php require "+repr(str(core))+"; $s=['timezone'=>'America/New_York','time'=>'09:00','frequency'=>'daily','weekday'=>1]; $a=strtotime('2027-03-13 15:00:00 UTC'); $n=sa_next_time($s,$a); echo gmdate('c',$n); ")
        assert subprocess.check_output([PHP,'-n',str(fixture)]).decode()=='2027-03-14T13:00:00+00:00'
        # Login limit fails closed after eight attempts in one window.
        limits=data/'limits.json'; values=json.loads(limits.read_text()); values={k:v for k,v in values.items() if not k.startswith('login-')};limits.write_text(json.dumps(values))
        for _ in range(8): guest.call('login',{'username':'nobody','password':'bad'},401)
        guest.call('login',{'username':'nobody','password':'bad'},429)
        print('PASS: authentication, role isolation, CSRF, activation, revocation, password changes, catalog conflicts, explicit/type filtering, playlist membership, URL validation, scan, reporting, duplicate cron protection, DST, and rate limits. No email sent.')
    finally:
        server.terminate();server.wait(timeout=5);log.close()
