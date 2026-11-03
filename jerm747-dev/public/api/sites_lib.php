<?php
// Helpers for the Sites area: sites in development, with a live preview, comments,
// a shared document, shared files and a slide deck.
// Data: api/data/sites/<slug>.json and api/data/site-files/<slug>/.
// Builds:  /sites/<folder>/ (the web address unless set otherwise; upload each build there).

declare(strict_types=1);

require_once __DIR__ . '/lib.php';

const SITE_STATUSES = ['concept', 'design', 'building', 'review', 'launched', 'paused'];
const SITE_MAX_FILE = 25 * 1024 * 1024; // decks and design files run bigger than portal attachments
const SLUG_REGEX = '/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/';
const DOC_REVISIONS_KEPT = 15;

function site_slug(?string $in): string {
    $s = strtolower(trim((string)$in));
    return preg_match(SLUG_REGEX, $s) ? $s : '';
}

function slugify(string $title): string {
    $s = strtolower(preg_replace('/[^A-Za-z0-9]+/', '-', str_replace(["'", '’'], '', $title)) ?? '');
    return trim(substr(trim($s, '-'), 0, 40), '-');
}

function site_path(string $slug): string {
    return data_dir('sites') . '/' . $slug . '.json';
}

function load_site(string $slug): ?array {
    if ($slug === '' || !is_file(site_path($slug))) return null;
    $s = json_decode((string)file_get_contents(site_path($slug)), true);
    return is_array($s) ? $s : null;
}

function save_site(array $s): void {
    $s['updated'] = now();
    $path = site_path($s['slug']);
    $tmp = $path . '.tmp';
    file_put_contents($tmp, json_encode($s, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), LOCK_EX);
    rename($tmp, $path);
}

function make_review_token(): string {
    $alphabet = '23456789abcdefghjkmnpqrstuvwxyz';
    $t = '';
    for ($i = 0; $i < 12; $i++) $t .= $alphabet[random_int(0, strlen($alphabet) - 1)];
    return $t;
}

function site_build_dir(string $slug): string {
    return dirname(__DIR__) . '/sites/' . $slug;
}

// The server folder that holds a site's build: sites/<folder>/. Usually the web address, but it
// can point at a folder made by hand (say the address is "returnity" and the upload is in "nige-hood").
function site_folder(array $s): string {
    return site_slug($s['folder'] ?? '') ?: $s['slug'];
}

function site_has_build(array $s): bool {
    return is_file(site_build_dir(site_folder($s)) . '/index.html');
}

function site_default_preview(array $s): string {
    return '/sites/' . site_folder($s) . '/';
}

// Every folder in sites/, and whether it has an index.html, so the admin page can show
// where builds actually are.
function server_site_folders(string $exceptSlug = ''): array {
    $usedBy = [];
    foreach (glob(data_dir('sites') . '/*.json') ?: [] as $file) {
        $o = json_decode((string)file_get_contents($file), true);
        if (is_array($o) && ($o['slug'] ?? '') !== $exceptSlug) $usedBy[site_folder($o)] = $o['title'] ?? $o['slug'];
    }
    $out = [];
    foreach (glob(dirname(__DIR__) . '/sites/*', GLOB_ONLYDIR) ?: [] as $dir) {
        $name = basename($dir);
        if (!site_slug($name)) {
            $out[] = ['name' => $name, 'has_build' => is_file("$dir/index.html"), 'usable' => false, 'used_by' => ''];
            continue;
        }
        $out[] = ['name' => $name, 'has_build' => is_file("$dir/index.html"), 'usable' => true, 'used_by' => $usedBy[$name] ?? ''];
    }
    usort($out, fn($a, $b) => strcmp($a['name'], $b['name']));
    return $out;
}

// Non-fatal admin check: Jeremy's browser sends the admin password header on every Sites call.
function is_admin_request(): bool {
    $given = (string)($_SERVER['HTTP_X_ADMIN_PASSWORD'] ?? '');
    $hash = admin_hash();
    if ($given === '' || !$hash) return false;
    if (password_verify($given, $hash)) return true;
    rate_limit('admin', 30, 900); // a stale saved password just means "not admin"; guesses still count
    return false;
}

// Who is asking: 'admin' (Jeremy), 'reviewer' (has the review link), 'viewer' (public site), or null.
function site_access(array $s, string $token, bool $admin): ?string {
    if ($admin) return 'admin';
    if ($token !== '' && hash_equals((string)$s['token'], $token)) return 'reviewer';
    if (!empty($s['public'])) return 'viewer';
    return null;
}

// What a browser gets. Review token only for people who already have it.
function site_view(array $s, string $access): array {
    $out = $s;
    unset($out['revisions']);
    if ($access !== 'admin') {
        unset($out['token'], $out['project_key'], $out['notes']);
        $out['comments'] = array_values(array_filter($s['comments'], fn($c) => empty($c['hidden'])));
    }
    if ($access === 'viewer') {
        // Public visitors see the work, not the working files.
        $deckId = $s['deck'] ?? '';
        $out['files'] = array_values(array_filter($s['files'], fn($f) => $f['id'] === $deckId));
    }
    $out['revision_log'] = array_map(fn($r) => ['v' => $r['v'], 'by' => $r['by'], 'at' => $r['at'], 'chars' => mb_strlen($r['body'])], array_reverse($s['revisions'] ?? []));
    $out['has_build'] = site_has_build($s);
    $out['preview_url'] = $s['preview_url'] ?: site_default_preview($s);
    $out['access'] = $access;
    if ($access === 'admin') {
        $out['folder'] = site_folder($s);
        $out['server_folders'] = server_site_folders($s['slug']);
        $out['preview_setting'] = $s['preview_url'] ?? ''; // what was typed (preview_url above has the default filled in)
    } else {
        unset($out['folder']);
    }
    return $out;
}

function site_summary(array $s, bool $admin): array {
    $out = [
        'slug' => $s['slug'], 'title' => $s['title'], 'client' => $s['client'], 'summary' => $s['summary'],
        'status' => $s['status'], 'public' => !empty($s['public']), 'updated' => $s['updated'],
        'comments' => count(array_filter($s['comments'], fn($c) => empty($c['hidden']))),
        'preview_url' => $s['preview_url'] ?: site_default_preview($s),
        'has_build' => site_has_build($s),
        'doc_by' => $s['doc']['edited_by'] ?? '', 'doc_at' => $s['doc']['edited_at'] ?? '',
    ];
    if ($admin) {
        $out['token'] = $s['token'];
        $out['folder'] = site_folder($s);
        $out['open'] = count(array_filter($s['comments'], fn($c) => empty($c['resolved']) && empty($c['hidden']) && $c['from'] !== 'jeremy'));
    }
    return $out;
}

function store_site_uploads(array &$site, string $from, string $author): array {
    if (empty($_FILES['files'])) return [];
    $f = $_FILES['files'];
    $added = [];
    foreach ((array)$f['name'] as $i => $name) {
        $err = ((array)$f['error'])[$i];
        if ($err === UPLOAD_ERR_NO_FILE) continue;
        if ($err !== UPLOAD_ERR_OK) fail("$name didn't upload. Files can be up to 25 MB each.");
        $size = (int)((array)$f['size'])[$i];
        if ($size > SITE_MAX_FILE) fail("$name is over 25 MB. Send a smaller file or a share link.");
        $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        if (!in_array($ext, ALLOWED_EXT, true)) fail("$name isn't a supported file type. Zip it and try again.");
        $id = new_id();
        $safe = preg_replace('/[^A-Za-z0-9._-]/', '_', basename($name));
        $dir = data_dir('site-files/' . $site['slug']);
        if (!move_uploaded_file(((array)$f['tmp_name'])[$i], "$dir/$id-$safe")) fail('Couldn\'t save the file. Try again.', 500);
        $rec = ['id' => $id, 'name' => $safe, 'size' => $size, 'from' => $from, 'author' => $author, 'at' => now()];
        $site['files'][] = $rec;
        $added[] = $rec;
    }
    return $added;
}

function site_link(array $s, bool $withToken): string {
    return SITE_URL . '/#/sites/' . $s['slug'] . ($withToken ? '/' . $s['token'] : '');
}
