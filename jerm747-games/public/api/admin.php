<?php
// Admin API for jerm747.games. Every call except "status" and first-time "setup" needs the
// X-Admin-Password header.
//
// GET  ?action=status                      -> is the admin password set?
// POST action=setup  {password}            -> set password (only works once)
// GET  ?action=stats&days=30               -> visitor analytics
// GET  ?action=settings                    -> report settings + cron command
// POST action=settings report_hours(0|12|24)
// POST action=report_test                  -> send a traffic report now
require __DIR__ . '/lib.php';

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

switch ($action) {
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
}

fail('Unknown action.');
