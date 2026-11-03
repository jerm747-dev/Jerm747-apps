<?php
// Sites in development: showcase, comments, shared document, shared files, slide deck.
//
// Access: public sites can be viewed and commented on by anyone. Private sites need the
// review link (#/sites/<slug>/<token>). Editing the document and uploading files need the
// review link too. Jeremy's admin password header unlocks everything.
//
// GET  ?action=list                              -> public sites (all sites for admin)
// GET  ?action=get&slug=&token=                  -> one site
// GET  ?action=revision&slug=&token=&v=          -> an earlier version of the document
// POST action=comment  slug token name body page -> add a comment
// POST action=doc      slug token name body base -> save the shared document (base = version you edited)
// POST action=upload   slug token name files[]   -> share files
// Admin only:
// POST action=save     slug? title client summary status public preview_url project_key notes
// POST action=comment_flag slug id resolved|hidden (0/1)
// POST action=file_delete  slug id
// POST action=deck     slug id ('' to clear)     -> which PDF the slide viewer shows
// POST action=set_public slug public (0/1)       -> show on / hide from the public Sites page
// POST action=set_folder slug folder             -> which sites/<folder>/ holds the build (made if missing)
// POST action=new_token slug                     -> new review link (old one stops working)
// POST action=delete   slug confirm=slug         -> remove the site record and its shared files
require __DIR__ . '/sites_lib.php';

$method = $_SERVER['REQUEST_METHOD'];
$isJson = str_contains($_SERVER['CONTENT_TYPE'] ?? '', 'application/json');
$in = $method === 'POST' ? ($isJson ? body_json() : $_POST) : $_GET;
$action = (string)($in['action'] ?? '');
$admin = is_admin_request();
$token = preg_replace('/[^a-z0-9]/', '', strtolower((string)($in['token'] ?? ''))) ?? '';

function must_site(array $in, string $token, bool $admin, bool $write = false): array {
    $s = load_site(site_slug($in['slug'] ?? ''));
    $access = $s ? site_access($s, $token, $admin) : null;
    if (!$s || !$access) fail('No site here. Check the link you were sent.', 404);
    if ($write && $access === 'viewer') fail('Editing needs the review link Jeremy sent you.', 403);
    return [$s, $access];
}

function author_name(array $in, string $access): string {
    if ($access === 'admin') return 'Jeremy';
    $name = clean($in['name'] ?? '', 60);
    if ($name === '') fail('Add your name so everyone knows who said what.');
    return $name;
}

if ($method === 'GET' && $action === 'list') {
    $out = [];
    foreach (glob(data_dir('sites') . '/*.json') as $file) {
        $s = json_decode((string)file_get_contents($file), true);
        if (!is_array($s) || (!$admin && empty($s['public']))) continue;
        $out[] = site_summary($s, $admin);
    }
    usort($out, fn($a, $b) => strcmp($b['updated'], $a['updated']));
    respond(['ok' => true, 'sites' => $out]);
}

if ($method === 'GET' && $action === 'get') {
    rate_limit('site-view', 120, 900);
    [$s, $access] = must_site($in, $token, $admin);
    respond(['ok' => true, 'site' => site_view($s, $access)]);
}

if ($method === 'GET' && $action === 'revision') {
    [$s, $access] = must_site($in, $token, $admin);
    $v = (int)($in['v'] ?? 0);
    foreach ($s['revisions'] ?? [] as $r) {
        if ($r['v'] === $v) respond(['ok' => true, 'revision' => $r]);
    }
    fail('That version is no longer kept.', 404);
}

if ($method !== 'POST') fail('Unsupported method.', 405);

switch ($action) {
    case 'comment':
        rate_limit('site-comment', 20, 3600);
        [$s, $access] = must_site($in, $token, $admin);
        $author = author_name($in, $access);
        $body = clean($in['body'] ?? '', 4000);
        if ($body === '') fail('Write a comment first.');
        $c = [
            'id' => new_id(), 'from' => $access === 'admin' ? 'jeremy' : $access, 'author' => $author,
            'body' => $body, 'page' => clean($in['page'] ?? '', 80), 'at' => now(), 'resolved' => false,
        ];
        $s['comments'][] = $c;
        save_site($s);
        if ($access !== 'admin') {
            send_mail(ADMIN_EMAIL, "Comment on {$s['title']} from $author",
                ($c['page'] ? "About: {$c['page']}\n\n" : '') . "$body\n\nOpen it: " . site_link($s, true) . "\n");
        }
        respond(['ok' => true, 'site' => site_view($s, $access)]);

    case 'doc':
        rate_limit('site-doc', 60, 3600);
        [$s, $access] = must_site($in, $token, $admin, true);
        $author = author_name($in, $access);
        $body = clean($in['body'] ?? '', 60000);
        $base = (int)($in['base'] ?? -1);
        $current = (int)($s['doc']['version'] ?? 0);
        if ($base !== $current) {
            respond(['ok' => false, 'conflict' => true,
                'error' => ($s['doc']['edited_by'] ?: 'Someone') . ' saved a newer version while you were editing. Your text is still in the box: copy it, load their version, then add your changes.',
                'site' => site_view($s, $access)], 409);
        }
        if ($body === ($s['doc']['body'] ?? '')) respond(['ok' => true, 'site' => site_view($s, $access), 'unchanged' => true]);
        $s['revisions'][] = ['v' => $current, 'by' => $s['doc']['edited_by'] ?? '', 'at' => $s['doc']['edited_at'] ?? '', 'body' => $s['doc']['body'] ?? ''];
        $s['revisions'] = array_slice(array_values(array_filter($s['revisions'], fn($r) => $r['at'] !== '')), -DOC_REVISIONS_KEPT);
        $s['doc'] = ['body' => $body, 'version' => $current + 1, 'edited_by' => $author, 'edited_at' => now()];
        save_site($s);
        if ($access !== 'admin') {
            send_mail(ADMIN_EMAIL, "$author edited the shared doc for {$s['title']}", "Open it: " . site_link($s, true) . "\n");
        }
        respond(['ok' => true, 'site' => site_view($s, $access)]);

    case 'upload':
        rate_limit('site-upload', 30, 3600);
        [$s, $access] = must_site($in, $token, $admin, true);
        $author = author_name($in, $access);
        $added = store_site_uploads($s, $access === 'admin' ? 'jeremy' : 'reviewer', $author);
        if (!$added) fail('Pick at least one file.');
        // First PDF shared becomes the slide deck unless one is already set.
        if (empty($s['deck'])) {
            foreach ($added as $f) if (str_ends_with(strtolower($f['name']), '.pdf')) { $s['deck'] = $f['id']; break; }
        }
        save_site($s);
        if ($access !== 'admin') {
            send_mail(ADMIN_EMAIL, "$author shared files on {$s['title']}",
                implode("\n", array_map(fn($f) => $f['name'], $added)) . "\n\nOpen it: " . site_link($s, true) . "\n");
        }
        respond(['ok' => true, 'site' => site_view($s, $access)]);
}

// Everything below is Jeremy only.
if (!$admin) fail('Sign in on the admin page first.', 401);

switch ($action) {
    case 'save':
        $slug = site_slug($in['slug'] ?? '');
        $s = $slug ? load_site($slug) : null;
        $title = clean($in['title'] ?? '', 120);
        if ($title === '') fail('Give the site a name.');
        if (!$s) {
            $slug = site_slug($in['new_slug'] ?? '') ?: slugify($title);
            if (!site_slug($slug)) fail('Pick a web address using letters, numbers and dashes.');
            if (load_site($slug)) fail("There's already a site at /sites/$slug. Pick another address.");
            $s = [
                'slug' => $slug, 'created' => now(), 'updated' => now(), 'token' => make_review_token(),
                'comments' => [], 'files' => [], 'deck' => '', 'revisions' => [],
                'doc' => ['body' => '', 'version' => 0, 'edited_by' => '', 'edited_at' => ''],
            ];
        }
        $status = (string)($in['status'] ?? 'building');
        $preview = clean($in['preview_url'] ?? '', 300);
        if ($preview !== '' && !preg_match('#^(/|https://)#', $preview)) fail('Preview address must start with / or https://');
        $s['title'] = $title;
        $s['client'] = clean($in['client'] ?? '', 120);
        $s['summary'] = clean($in['summary'] ?? '', 600);
        $s['status'] = in_array($status, SITE_STATUSES, true) ? $status : 'building';
        $s['public'] = in_array((string)($in['public'] ?? ''), ['1', 'true'], true);
        $s['preview_url'] = $preview;
        $s['project_key'] = normalize_key($in['project_key'] ?? '');
        $s['notes'] = clean($in['notes'] ?? '', 4000);
        save_site($s);
        @mkdir(site_build_dir(site_folder($s)), 0755, true);
        respond(['ok' => true, 'site' => site_view($s, 'admin')]);

    case 'comment_flag':
        $s = load_site(site_slug($in['slug'] ?? '')) ?? fail('Site not found.', 404);
        foreach ($s['comments'] as &$c) {
            if ($c['id'] !== ($in['id'] ?? '')) continue;
            if (isset($in['resolved'])) $c['resolved'] = $in['resolved'] === '1';
            if (isset($in['hidden'])) $c['hidden'] = $in['hidden'] === '1';
        }
        unset($c);
        save_site($s);
        respond(['ok' => true, 'site' => site_view($s, 'admin')]);

    case 'file_delete':
        $s = load_site(site_slug($in['slug'] ?? '')) ?? fail('Site not found.', 404);
        $id = (string)($in['id'] ?? '');
        foreach ($s['files'] as $f) {
            if ($f['id'] === $id) @unlink(data_dir('site-files/' . $s['slug']) . "/{$f['id']}-{$f['name']}");
        }
        $s['files'] = array_values(array_filter($s['files'], fn($f) => $f['id'] !== $id));
        if (($s['deck'] ?? '') === $id) $s['deck'] = '';
        save_site($s);
        respond(['ok' => true, 'site' => site_view($s, 'admin')]);

    case 'deck':
        $s = load_site(site_slug($in['slug'] ?? '')) ?? fail('Site not found.', 404);
        $id = (string)($in['id'] ?? '');
        if ($id !== '' && !array_filter($s['files'], fn($f) => $f['id'] === $id && str_ends_with(strtolower($f['name']), '.pdf'))) {
            fail('The slide viewer shows PDFs. In PowerPoint use File > Save As > PDF, then share that file.');
        }
        $s['deck'] = $id;
        save_site($s);
        respond(['ok' => true, 'site' => site_view($s, 'admin')]);

    case 'set_public':
        $s = load_site(site_slug($in['slug'] ?? '')) ?? fail('Site not found.', 404);
        $s['public'] = in_array((string)($in['public'] ?? ''), ['1', 'true'], true);
        save_site($s);
        respond(['ok' => true, 'site' => site_view($s, 'admin')]);

    case 'set_folder':
        $s = load_site(site_slug($in['slug'] ?? '')) ?? fail('Site not found.', 404);
        $folder = site_slug($in['folder'] ?? '');
        if ($folder === '') fail('Folder names use lowercase letters, numbers and dashes, like nige-hood.');
        @mkdir(site_build_dir($folder), 0755, true);
        $s['folder'] = $folder === $s['slug'] ? '' : $folder;
        save_site($s);
        respond(['ok' => true, 'site' => site_view($s, 'admin')]);

    case 'new_token':
        $s = load_site(site_slug($in['slug'] ?? '')) ?? fail('Site not found.', 404);
        $s['token'] = make_review_token();
        save_site($s);
        respond(['ok' => true, 'site' => site_view($s, 'admin')]);

    case 'delete':
        $slug = site_slug($in['slug'] ?? '');
        $s = load_site($slug) ?? fail('Site not found.', 404);
        if (($in['confirm'] ?? '') !== $slug) fail('Type the site address to confirm.');
        foreach (glob(data_dir('site-files/' . $slug) . '/*') as $f) @unlink($f);
        @rmdir(data_dir('site-files/' . $slug));
        unlink(site_path($slug));
        respond(['ok' => true]);
}

fail('Unknown action.');
