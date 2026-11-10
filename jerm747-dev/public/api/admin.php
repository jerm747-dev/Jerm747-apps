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
// POST action=create   name, email, title  -> start a project yourself (phone/in-person leads)
// GET  ?action=stats&days=30               -> visitor analytics
// GET  ?action=settings                    -> report settings + cron command
// POST action=settings report_hours(0|12|24)
// POST action=report_test                  -> send a traffic report now
// GET  ?action=shares                      -> shared private pages with visits and downloads
// POST action=share id, op                 -> op: takedown | restore | extend | notify | title
require __DIR__ . '/lib.php';
require __DIR__ . '/shares_lib.php';

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

switch ($action) {
    case 'list':
        $out = [];
        foreach (glob(data_dir('projects') . '/*.json') as $file) {
            $p = json_decode((string)file_get_contents($file), true);
            if (!is_array($p)) continue;
            $last = end($p['messages']) ?: null;
            $out[] = [
                'key' => $p['key'], 'title' => $p['title'], 'stage' => $p['stage'],
                'client' => $p['client'], 'created' => $p['created'], 'updated' => $p['updated'],
                'waiting' => $last && $last['from'] === 'client',
            ];
        }
        usort($out, fn($a, $b) => strcmp($b['updated'], $a['updated']));
        respond(['ok' => true, 'projects' => $out]);

    case 'get':
        respond(['ok' => true, 'project' => must_project($in)]);

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
        respond(['ok' => true, 'project' => $p]);

    case 'update':
        $p = must_project($in);
        $title = clean($in['title'] ?? '', 140);
        $body = clean($in['body'] ?? '', 4000);
        if ($title === '') fail('Give the update a title.');
        $p['updates'][] = ['id' => new_id(), 'title' => $title, 'body' => $body, 'at' => now()];
        save_project($p);
        send_mail($p['client']['email'], "Project update: $title",
            "Hi {$p['client']['name']},\n\n$title\n$body\n\nSee the full project:\n" . portal_link($p['key']) . "\n\nJeremy\njerm747.dev\n");
        respond(['ok' => true, 'project' => $p]);

    case 'stage':
        $p = must_project($in);
        $stage = (string)($in['stage'] ?? '');
        if (!in_array($stage, STAGES, true)) fail('Unknown stage.');
        $p['stage'] = $stage;
        save_project($p);
        respond(['ok' => true, 'project' => $p]);

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
        respond(['ok' => true, 'project' => $p]);

    case 'notes':
        $p = must_project($in);
        $p['notes'] = clean($in['notes'] ?? '', 10000);
        save_project($p);
        respond(['ok' => true, 'project' => $p]);

    case 'stats':
        $days = max(1, min(90, (int)($in['days'] ?? 30)));
        respond(['ok' => true, 'stats' => build_stats($days)]);

    case 'settings':
        $s = settings();
        if ($method === 'POST') {
            $h = (int)($in['report_hours'] ?? 24);
            if (!in_array($h, [0, 12, 24], true)) fail('Pick 12 hours, 24 hours or off.');
            $s['report_hours'] = $h;
            save_settings($s);
        }
        respond(['ok' => true, 'settings' => [
            'report_hours' => $s['report_hours'],
            'last_report' => $s['last_report'] ? gmdate('c', (int)$s['last_report']) : null,
            'cron_command' => 'php ' . __DIR__ . '/report.php',
            'cron_url' => SITE_URL . '/api/report.php?token=' . $s['report_token'],
        ]]);

    case 'report_test':
        $ok = maybe_send_report(true);
        respond(['ok' => true, 'sent' => $ok, 'preview' => report_text(max(12, (int)settings()['report_hours']))]);

    case 'shares':
        maybe_share_reminders();
        respond(['ok' => true, 'shares' => share_list()]);

    case 'share':
        $id = (string)($in['id'] ?? '');
        if (!share_load($id)) fail('Shared page not found.', 404);
        $op = (string)($in['op'] ?? '');
        if (!in_array($op, ['takedown', 'restore', 'extend', 'notify', 'title'], true)) fail('Unknown change.');
        $flag = fn($k) => in_array((string)($in[$k] ?? ''), ['1', 'true'], true);
        $s = share_update($id, function (array $s) use ($op, $in, $flag) {
            switch ($op) {
                case 'takedown': $s['active'] = false; $s['taken_down'] = now(); break;
                case 'restore': $s['active'] = true; $s['taken_down'] = null; break;
                case 'extend':
                    $days = max(1, min(365, (int)($in['days'] ?? SHARE_DEFAULT_DAYS)));
                    $s['expires'] = gmdate('c', max(time(), strtotime($s['expires'])) + $days * 86400);
                    $s['reminded'] = null;
                    break;
                case 'notify':
                    foreach (['notify_first_visit', 'notify_first_download', 'notify_downloads'] as $k) {
                        if (array_key_exists($k, $in)) $s[$k] = $flag($k);
                    }
                    break;
                case 'title':
                    $t = clean($in['title'] ?? '', 140);
                    if ($t !== '') $s['title'] = $t;
                    break;
            }
            return $s;
        });
        respond(['ok' => true, 'share' => share_summary($s)]);

    case 'create':
        $name = clean($in['name'] ?? '', 120);
        $email = clean($in['email'] ?? '', 200);
        if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Add the client\'s name and a valid email.');
        $key = make_key();
        $p = [
            'key' => $key, 'created' => now(), 'updated' => now(), 'stage' => 'reviewing',
            'title' => clean($in['title'] ?? '', 140) ?: "$name project",
            'client' => ['name' => $name, 'email' => $email, 'company' => clean($in['company'] ?? '', 160)],
            'request' => ['type' => '', 'budget' => '', 'timeline' => '', 'estimate' => ''],
            'messages' => [], 'updates' => [['id' => new_id(), 'title' => 'Project opened', 'body' => '', 'at' => now()]],
            'items' => [], 'files' => [], 'notes' => '',
        ];
        save_project($p);
        if (!empty($in['notify'])) {
            send_mail($email, "Your jerm747.dev project key: $key",
                "Hi $name,\n\nI've opened a project page for us. Your project key is:\n\n    $key\n\n" . portal_link($key) . "\n\nJeremy\njerm747.dev\n");
        }
        respond(['ok' => true, 'project' => $p]);
}

fail('Unknown action.');
