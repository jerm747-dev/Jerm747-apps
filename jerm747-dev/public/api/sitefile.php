<?php
// GET ?slug=&id=&token=[&inline=1] downloads a shared file for a site.
// Public visitors can only open the slide deck; everything else needs the review link or admin.
require __DIR__ . '/sites_lib.php';

rate_limit('site-file', 200, 900);
$admin = is_admin_request();
$token = preg_replace('/[^a-z0-9]/', '', strtolower((string)($_GET['token'] ?? ''))) ?? '';
$s = load_site(site_slug($_GET['slug'] ?? ''));
$access = $s ? site_access($s, $token, $admin) : null;
$id = preg_replace('/[^a-f0-9]/', '', (string)($_GET['id'] ?? ''));
if (!$s || !$access || $id === '') fail('File not found.', 404);
if ($access === 'viewer' && $id !== ($s['deck'] ?? '')) fail('File not found.', 404);

foreach ($s['files'] as $f) {
    if ($f['id'] !== $id) continue;
    $path = data_dir('site-files/' . $s['slug']) . '/' . $f['id'] . '-' . $f['name'];
    if (!is_file($path)) break;
    $isPdf = str_ends_with(strtolower($f['name']), '.pdf');
    $inline = $isPdf && !empty($_GET['inline']);
    header('Content-Type: ' . ($isPdf ? 'application/pdf' : 'application/octet-stream'));
    header('Content-Disposition: ' . ($inline ? 'inline' : 'attachment') . '; filename="' . $f['name'] . '"');
    header('Content-Length: ' . filesize($path));
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: private, max-age=300');
    readfile($path);
    exit;
}
fail('File not found.', 404);
