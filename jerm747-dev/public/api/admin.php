<?php
// Jeremy's admin API. Every call except "status" and first-time "setup" needs the
// X-Admin-Password header (or a "password" form field for uploads).
//
// GET  ?action=status                      -> is the admin password set?
// POST action=setup  {password}            -> set password (only works once)
// GET  ?action=list                        -> all projects (summary)
// GET  ?action=get&key=...                 -> one project, including private notes
// POST action=message  key, body, files[]  -> reply to client (emails them)
// POST action=update   key, title, body    -> post a progress update (emails them)
// POST action=stage    key, stage          -> change stage
// POST action=items    key, items(json)    -> replace deliverables list
// POST action=notes    key, notes          -> private notes (never shown to client)
// POST action=create   name, email, title  -> start a project yourself (phone/in-person leads).
//                       Doesn't email anyone; call send_key next. A second project for the same
//                       email within a day comes back as {duplicate} unless allow_duplicate=1.
// POST action=send_key key                 -> email the client their project key (returns a copy of the email)
// GET  ?action=key_email                   -> the project-key email with placeholders, for previews
// POST action=link_site key, slug, on(1|0) -> link a site in development to this project (or unlink it)
// POST action=delete   key, confirm=key    -> delete a project (moved to api/data/deleted/, not erased)
// GET  ?action=stats&days=30               -> visitor analytics
// GET  ?action=settings                    -> report settings + cron command
// POST action=settings report_hours(0|12|24), report_email, admin_box(0|1)
// POST action=report_test                  -> send a traffic report now
require __DIR__ . '/lib.php';
require_once __DIR__ . '/sites_lib.php';

$method = $_SERVER['REQUEST_METHOD'];
$isJson = str_contains($_SERVER['CONTENT_TYPE'] ?? '', 'application/json');
$in = $method === 'POST' ? ($isJson ? body_json() : $_POST) : $_GET;
$action = (string)($in['action'] ?? '');

if ($action === 'status') respond(['ok' => true, 'setup' => admin_hash() !== null]);

if ($action === 'setup') {
    if (admin_hash()) fail('Admin password is already set. Delete api/data/admin.json in your host\'s file manager to reset it.', 403);
    $pw = (string)($in['password'] ?? '');
    if (strlen($pw) < 12) fail('Use at least 12 characters.');
    file_put_contents(data_dir() . '/admin.json', json_encode(['hash' => password_hash($pw, PASSWORD_DEFAULT), 'at' => now()]), LOCK_EX);
    respond(['ok' => true]);
}

require_admin();

function must_project(array $in): array {
    $p = load_project(normalize_key($in['key'] ?? ''));
    if (!$p) fail('Project not found.', 404);
    return $p;
}

// Every site in development: slug, title, linked project key.
function all_sites_brief(): array {
    $out = [];
    foreach (glob(data_dir('sites') . '/*.json') as $file) {
        $s = json_decode((string)file_get_contents($file), true);
        if (!is_array($s) || empty($s['slug'])) continue;
        $out[] = ['slug' => $s['slug'], 'title' => $s['title'] ?? $s['slug'], 'project_key' => (string)($s['project_key'] ?? '')];
    }
    usort($out, fn($a, $b) => strcasecmp($a['title'], $b['title']));
    return $out;
}

// A project plus the site links the admin page shows with it.
function admin_view(array $p): array {
    $sites = all_sites_brief();
    $p['linked_sites'] = array_values(array_filter($sites, fn($s) => $s['project_key'] === $p['key']));
    $p['all_sites'] = $sites;
    return $p;
}

// The email a client gets with their project key. One template for sending and for previews.
function key_email(string $name, string $key, string $email = ''): array {
    return [
        'to' => $email,
        'from' => 'Jeremy at jerm747.dev <' . MAIL_FROM . '>',
        'subject' => "Your jerm747.dev project key: $key",
        'body' => "Hi $name,\n\nI've opened a project page for us. Your project key is:\n\n    $key\n\n" . portal_link($key) . "\n\nJeremy\njerm747.dev\n",
    ];
}

switch ($action) {
    case 'list':
        $out = [];
        foreach (glob(data_dir('projects') . '/*.json') as $file) {
            $p = json_decode((string)file_get_contents($file), true);
            if (!is_array($p)) continue;
            $last = end($p['messages']) ?: null;
            $out[] = [
                'sites' => [],
                'key' => $p['key'], 'title' => $p['title'], 'stage' => $p['stage'],
                'client' => $p['client'], 'created' => $p['created'], 'updated' => $p['updated'],
                'waiting' => $last && $last['from'] === 'client',
            ];
        }
        usort($out, fn($a, $b) => strcmp($b['updated'], $a['updated']));
        $byKey = [];
        foreach (all_sites_brief() as $s) if ($s['project_key'] !== '') $byKey[$s['project_key']][] = ['slug' => $s['slug'], 'title' => $s['title']];
        foreach ($out as &$row) $row['sites'] = $byKey[$row['key']] ?? [];
        unset($row);
        respond(['ok' => true, 'projects' => $out]);

    case 'get':
        respond(['ok' => true, 'project' => admin_view(must_project($in))]);

    case 'key_email':
        respond(['ok' => true, 'email' => key_email('{name}', '{key}', '{email}')]);

    case 'send_key':
        $p = must_project($in);
        $mail = key_email($p['client']['name'], $p['key'], $p['client']['email']);
        $sent = send_mail($mail['to'], $mail['subject'], $mail['body']);
        $mail['sent'] = $sent;
        $mail['at'] = now();
        $p['emails'][] = ['kind' => 'project_key', 'to' => $mail['to'], 'subject' => $mail['subject'], 'at' => $mail['at'], 'sent' => $sent];
        save_project($p);
        respond(['ok' => true, 'project' => admin_view($p), 'email' => $mail]);

    case 'link_site':
        $p = must_project($in);
        $s = load_site(site_slug($in['slug'] ?? ''));
        if (!$s) fail('Site not found.', 404);
        $on = in_array((string)($in['on'] ?? '1'), ['1', 'true'], true);
        if ($on) $s['project_key'] = $p['key'];
        elseif (($s['project_key'] ?? '') === $p['key']) $s['project_key'] = '';
        save_site($s);
        respond(['ok' => true, 'project' => admin_view($p)]);

    case 'delete':
        $p = must_project($in);
        if (normalize_key($in['confirm'] ?? '') !== $p['key']) fail("Type the project key ({$p['key']}) to delete it.");
        $stamp = gmdate('Ymd-His');
        $bin = data_dir('deleted');
        rename(project_path($p['key']), "$bin/{$p['key']}-$stamp.json");
        $files = data_dir('files') . '/' . $p['key'];
        if (is_dir($files)) rename($files, "$bin/{$p['key']}-$stamp-files");
        foreach (all_sites_brief() as $brief) {
            if ($brief['project_key'] !== $p['key']) continue;
            $s = load_site($brief['slug']);
            if ($s) { $s['project_key'] = ''; save_site($s); }
        }
        respond(['ok' => true, 'deleted' => $p['key']]);

    case 'message':
        $p = must_project($in);
        $body = clean($in['body'] ?? '', 8000);
        $fileIds = store_uploads($p, 'jeremy');
        if ($body === '' && !$fileIds) fail('Write a message or attach a file.');
        $p['messages'][] = ['id' => new_id(), 'from' => 'jeremy', 'author' => 'Jeremy', 'body' => $body, 'at' => now(), 'files' => $fileIds];
        save_project($p);
        send_mail($p['client']['email'], "New message on your project {$p['key']}",
            "Hi {$p['client']['name']},\n\n$body\n\n" . ($fileIds ? '(' . count($fileIds) . " file(s) attached on your project page)\n\n" : '') .
            "Reply on your project page:\n" . portal_link($p['key']) . "\n\nJeremy\njerm747.dev\n");
        respond(['ok' => true, 'project' => admin_view($p)]);

    case 'update':
        $p = must_project($in);
        $title = clean($in['title'] ?? '', 140);
        $body = clean($in['body'] ?? '', 4000);
        if ($title === '') fail('Give the update a title.');
        $p['updates'][] = ['id' => new_id(), 'title' => $title, 'body' => $body, 'at' => now()];
        save_project($p);
        send_mail($p['client']['email'], "Project update: $title",
            "Hi {$p['client']['name']},\n\n$title\n$body\n\nSee the full project:\n" . portal_link($p['key']) . "\n\nJeremy\njerm747.dev\n");
        respond(['ok' => true, 'project' => admin_view($p)]);

    case 'stage':
        $p = must_project($in);
        $stage = (string)($in['stage'] ?? '');
        if (!in_array($stage, STAGES, true)) fail('Unknown stage.');
        $p['stage'] = $stage;
        save_project($p);
        respond(['ok' => true, 'project' => admin_view($p)]);

    case 'items':
        $p = must_project($in);
        $items = is_array($in['items'] ?? null) ? $in['items'] : json_decode((string)($in['items'] ?? '[]'), true);
        if (!is_array($items)) fail('Items must be a list.');
        $p['items'] = array_values(array_map(fn($it) => [
            'label' => clean($it['label'] ?? '', 140),
            'detail' => clean($it['detail'] ?? '', 500),
            'status' => in_array($it['status'] ?? '', ['planned', 'in_progress', 'done'], true) ? $it['status'] : 'planned',
        ], array_filter($items, fn($it) => is_array($it) && trim((string)($it['label'] ?? '')) !== '')));
        save_project($p);
        respond(['ok' => true, 'project' => admin_view($p)]);

    case 'notes':
        $p = must_project($in);
        $p['notes'] = clean($in['notes'] ?? '', 10000);
        save_project($p);
        respond(['ok' => true, 'project' => admin_view($p)]);

    case 'stats':
        $days = max(1, min(90, (int)($in['days'] ?? 30)));
        respond(['ok' => true, 'stats' => build_stats($days)]);

    case 'settings':
        $s = settings();
        if ($method === 'POST') {
            if (isset($in['report_hours'])) {
                $h = (int)$in['report_hours'];
                if (!in_array($h, [0, 12, 24], true)) fail('Pick 12 hours, 24 hours or off.');
                $s['report_hours'] = $h;
            }
            if (isset($in['report_email'])) {
                $e = trim((string)$in['report_email']);
                if ($e !== '' && !filter_var($e, FILTER_VALIDATE_EMAIL)) fail('That email address doesn\'t look right.');
                $s['report_email'] = $e;
            }
            if (isset($in['admin_box'])) $s['admin_box'] = in_array((string)$in['admin_box'], ['1', 'true'], true);
            if (empty($s['admin_box']) && trim((string)$s['report_email']) === '') $s['admin_box'] = true; // never leave it with nowhere to send
            save_settings($s);
        }
        respond(['ok' => true, 'settings' => [
            'report_hours' => $s['report_hours'],
            'report_email' => (string)$s['report_email'],
            'admin_box' => (bool)$s['admin_box'],
            'admin_email' => ADMIN_EMAIL,
            'recipients' => admin_recipients($s),
            'last_report' => $s['last_report'] ? gmdate('c', (int)$s['last_report']) : null,
            'cron_command' => 'php ' . __DIR__ . '/report.php',
            'cron_url' => SITE_URL . '/api/report.php?token=' . $s['report_token'],
        ]]);

    case 'report_test':
        $ok = maybe_send_report(true);
        respond(['ok' => true, 'sent' => $ok, 'to' => admin_recipients(), 'preview' => report_text(max(12, (int)settings()['report_hours']))]);

    case 'create':
        $name = clean($in['name'] ?? '', 120);
        $email = clean($in['email'] ?? '', 200);
        if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Add the client\'s name and a valid email.');
        if (!in_array((string)($in['allow_duplicate'] ?? ''), ['1', 'true'], true)) {
            foreach (glob(data_dir('projects') . '/*.json') as $file) {
                $other = json_decode((string)file_get_contents($file), true);
                if (!is_array($other) || strcasecmp($other['client']['email'] ?? '', $email) !== 0) continue;
                if (strtotime($other['created']) < time() - 86400) continue;
                respond(['ok' => false, 'error' => "You opened {$other['key']} for $email " . ($other['title'] ? "(\"{$other['title']}\") " : '') . 'in the last day.',
                    'duplicate' => ['key' => $other['key'], 'title' => $other['title'], 'created' => $other['created']]], 409);
            }
        }
        $key = make_key();
        $p = [
            'key' => $key, 'created' => now(), 'updated' => now(), 'stage' => 'reviewing',
            'title' => clean($in['title'] ?? '', 140) ?: "$name project",
            'client' => ['name' => $name, 'email' => $email, 'company' => clean($in['company'] ?? '', 160)],
            'request' => ['type' => '', 'budget' => '', 'timeline' => '', 'estimate' => ''],
            'messages' => [], 'updates' => [['id' => new_id(), 'title' => 'Project opened', 'body' => '', 'at' => now()]],
            'items' => [], 'files' => [], 'notes' => '', 'emails' => [],
        ];
        save_project($p);
        respond(['ok' => true, 'project' => admin_view($p)]);
}

fail('Unknown action.');
