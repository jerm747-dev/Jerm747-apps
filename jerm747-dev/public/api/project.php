<?php
// Client portal API, unlocked by project key.
// GET  ?key=J747-XXXX-XXXX          -> project view
// POST key, body, files[] (form)    -> client message, emails Jeremy
require __DIR__ . '/lib.php';

$method = $_SERVER['REQUEST_METHOD'];
$key = normalize_key($method === 'GET' ? ($_GET['key'] ?? '') : ($_POST['key'] ?? ''));

if ($method === 'GET') {
    rate_limit('lookup', 40, 900);
    $p = $key ? load_project($key) : null;
    if (!$p) fail('No project matches that key. Check the email your key came in.', 404);
    respond(['ok' => true, 'project' => public_view($p)]);
}

if ($method === 'POST') {
    rate_limit('message', 30, 3600);
    $p = $key ? load_project($key) : null;
    if (!$p) fail('No project matches that key.', 404);
    $body = clean($_POST['body'] ?? '', 8000);
    $fileIds = store_uploads($p, 'client');
    if ($body === '' && !$fileIds) fail('Write a message or attach a file.');
    $p['messages'][] = [
        'id' => new_id(), 'from' => 'client', 'author' => $p['client']['name'],
        'body' => $body, 'at' => now(), 'files' => $fileIds,
    ];
    save_project($p);
    send_mail(ADMIN_EMAIL, "Message on {$p['key']} from {$p['client']['name']}",
        $body . ($fileIds ? "\n\n(" . count($fileIds) . " file(s) attached)" : '') .
        "\n\nOpen admin: " . SITE_URL . "/#/admin\n", $p['client']['email']);
    respond(['ok' => true, 'project' => public_view($p)]);
}

fail('Unsupported method.', 405);
