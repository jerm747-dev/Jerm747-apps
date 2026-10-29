<?php
// GET ?key=...&id=... downloads a project file. Admin may pass the password header instead of relying on the key alone.
require __DIR__ . '/lib.php';

rate_limit('file', 120, 900);
$key = normalize_key($_GET['key'] ?? '');
$id = preg_replace('/[^a-f0-9]/', '', (string)($_GET['id'] ?? ''));
$p = $key ? load_project($key) : null;
if (!$p || $id === '') fail('File not found.', 404);

foreach ($p['files'] as $f) {
    if ($f['id'] === $id) {
        $path = data_dir('files/' . $key) . '/' . $f['id'] . '-' . $f['name'];
        if (!is_file($path)) break;
        header('Content-Type: application/octet-stream');
        header('Content-Disposition: attachment; filename="' . $f['name'] . '"');
        header('Content-Length: ' . filesize($path));
        header('X-Content-Type-Options: nosniff');
        readfile($path);
        exit;
    }
}
fail('File not found.', 404);
