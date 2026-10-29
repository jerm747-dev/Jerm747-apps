<?php
// GET: lists every folder in /sandbox/projects that has an index.html.
// Add a project by uploading a folder there. An optional project.json in the folder sets
// its title, description and so on (see sandbox/projects/README.txt).
require __DIR__ . '/lib.php';

rate_limit('sandbox', 120, 900);
$root = dirname(__DIR__) . '/sandbox/projects';
$kinds = ['game', 'app', 'site', 'tool', 'music', 'experiment'];
$statuses = ['prototype', 'in_progress', 'playable', 'stable', 'client'];
$out = [];

foreach (glob($root . '/*', GLOB_ONLYDIR) ?: [] as $dir) {
    $slug = basename($dir);
    if (!preg_match('/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/', $slug) || !is_file("$dir/index.html")) continue;
    $m = is_file("$dir/project.json") ? (json_decode((string)file_get_contents("$dir/project.json"), true) ?: []) : [];
    if (!empty($m['hidden'])) continue;

    $cover = '';
    foreach (['cover.webp', 'cover.png', 'cover.jpg', 'cover.jpeg', 'cover.gif'] as $c) {
        if (is_file("$dir/$c")) { $cover = "projects/$slug/$c?v=" . filemtime("$dir/$c"); break; }
    }
    $html = (string)file_get_contents("$dir/index.html", false, null, 0, 4096);
    $title = $m['title'] ?? (preg_match('/<title>([^<]{1,80})<\/title>/i', $html, $t) ? html_entity_decode(trim($t[1])) : ucwords(str_replace(['-', '_'], ' ', $slug)));
    $updated = max(filemtime("$dir/index.html"), is_file("$dir/project.json") ? filemtime("$dir/project.json") : 0);

    $bridge = [];
    $labels = [];
    $btns = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'SELECT', 'START', 'UP', 'DOWN', 'LEFT', 'RIGHT'];
    foreach ((array)($m['gamepad'] ?? []) as $btn => $key) {
        if (in_array($btn, $btns, true) && is_string($key) && $key !== '' && mb_strlen($key) <= 20) {
            $bridge[$btn] = $key;
            $labels[$btn] = clean((string)(($m['gamepadLabels'] ?? [])[$btn] ?? ''), 30);
        }
    }

    $out[] = [
        'slug' => $slug,
        'url' => "projects/$slug/index.html",
        'title' => clean((string)$title, 80),
        'tagline' => clean((string)($m['tagline'] ?? ''), 140),
        'description' => clean((string)($m['description'] ?? ''), 1200),
        'kind' => in_array($m['kind'] ?? '', $kinds, true) ? $m['kind'] : 'experiment',
        'status' => in_array($m['status'] ?? '', $statuses, true) ? $m['status'] : 'in_progress',
        'version' => clean((string)($m['version'] ?? ''), 20),
        'controls' => array_values(array_intersect((array)($m['controls'] ?? []), ['gamepad', 'keyboard', 'mouse', 'touch'])),
        'credit' => clean((string)($m['credit'] ?? ''), 240),
        'accent' => preg_match('/^#[0-9a-fA-F]{6}$/', (string)($m['accent'] ?? '')) ? $m['accent'] : '',
        'cover' => $cover,
        'order' => (int)($m['order'] ?? 100),
        'gamepad' => (object)$bridge,
        'gamepadLabels' => (object)$labels,
        'updated' => gmdate('c', $updated),
    ];
}

usort($out, fn($a, $b) => [$a['order'], $b['updated']] <=> [$b['order'], $a['updated']]);
respond(['ok' => true, 'projects' => $out]);
