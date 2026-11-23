<?php
// Share page for one game: jerm747.games/play/<folder>
// Link previews (iMessage, Facebook, X, Discord, Slack, WhatsApp...) can't see the #/play/ part of
// a link, so this page gives them the game's own title, tagline and picture, then sends people
// straight on to the game in the arcade.
// Picture: share.jpg (1200 x 630) in the game's folder, else its cover.jpg / .png / .webp.
$root = dirname(__DIR__) . '/projects';
$slug = (string)($_GET['g'] ?? '');
if ($slug === 'game-music') $slug = 'sound-test';
$dir = "$root/$slug";
$site = 'https://jerm747.games';
$esc = fn($s) => htmlspecialchars((string)$s, ENT_QUOTES | ENT_HTML5, 'UTF-8');

if (!preg_match('/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/', $slug) || !is_file("$dir/index.html")) {
    header('Location: /', true, 302);
    exit;
}
$m = is_file("$dir/project.json") ? (json_decode((string)file_get_contents("$dir/project.json"), true) ?: []) : [];
if (!empty($m['hidden'])) { header('Location: /', true, 302); exit; }

$title = trim((string)($m['title'] ?? ucwords(str_replace(['-', '_'], ' ', $slug))));
$tagline = trim((string)($m['tagline'] ?? ''));
$desc = $tagline !== '' ? $tagline : 'Play it free in your browser at jerm747.games.';
if ($tagline !== '') $desc .= ' Play free in your browser.';

$image = ''; $type = 'image/jpeg'; $w = 1200; $h = 630;
foreach (['share.jpg' => 'image/jpeg', 'cover.jpg' => 'image/jpeg', 'cover.jpeg' => 'image/jpeg', 'cover.png' => 'image/png', 'cover.webp' => 'image/webp'] as $f => $t) {
    if (is_file("$dir/$f")) {
        $image = "$site/projects/$slug/$f?v=" . filemtime("$dir/$f");
        $type = $t;
        if ($f !== 'share.jpg' && ($size = @getimagesize("$dir/$f"))) { [$w, $h] = $size; }
        break;
    }
}

$shareSlug = $slug === 'sound-test' ? 'game-music' : $slug;
$pageUrl = "$site/play/$shareSlug";
$playUrl = "/#/play/$shareSlug";
$full = "$title · jerm747.games";

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: public, max-age=600');
?><!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title><?= $esc($full) ?></title>
<meta name="description" content="<?= $esc($desc) ?>">
<link rel="canonical" href="<?= $esc($pageUrl) ?>">
<meta property="og:type" content="website">
<meta property="og:site_name" content="jerm747.games">
<meta property="og:title" content="<?= $esc($full) ?>">
<meta property="og:description" content="<?= $esc($desc) ?>">
<meta property="og:url" content="<?= $esc($pageUrl) ?>">
<?php if ($image): ?>
<meta property="og:image" content="<?= $esc($image) ?>">
<meta property="og:image:secure_url" content="<?= $esc($image) ?>">
<meta property="og:image:type" content="<?= $esc($type) ?>">
<meta property="og:image:width" content="<?= (int)$w ?>">
<meta property="og:image:height" content="<?= (int)$h ?>">
<meta property="og:image:alt" content="<?= $esc($title) ?>">
<meta name="twitter:image" content="<?= $esc($image) ?>">
<?php endif; ?>
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="<?= $esc($full) ?>">
<meta name="twitter:description" content="<?= $esc($desc) ?>">
<meta name="theme-color" content="#07080d">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta http-equiv="refresh" content="0;url=<?= $esc($playUrl) ?>">
<script>location.replace(<?= json_encode($playUrl) ?>);</script>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#07080d;color:#e9ecf2;font:500 15px system-ui,sans-serif}a{color:#ff9f1c}</style>
</head><body><p>Opening <a href="<?= $esc($playUrl) ?>"><?= $esc($title) ?></a> on jerm747.games…</p></body></html>
