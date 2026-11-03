<?php
/** Site Admin v1: file-backed, per-site accounts, catalog and scheduled owner reports. */
declare(strict_types=1);

function sa_reply(array $data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    exit;
}
function sa_error(string $message, int $status = 400): void { throw new RuntimeException($message, $status); }
function sa_init(array $config): void {
    ini_set('display_errors', '0');
    $GLOBALS['sa'] = $config;
    if (!is_dir($config['dataDir']) && !mkdir($config['dataDir'], 0700, true)) sa_error('Storage is unavailable.', 503);
}
function sa_config(string $key) { return $GLOBALS['sa'][$key]; }
function sa_path(string $name): string { return sa_config('dataDir') . '/' . $name . '.json'; }
function sa_update(string $name, callable $fn, array $default = []): array {
    $lock = fopen(sa_path($name) . '.lock', 'c');
    if (!$lock || !flock($lock, LOCK_EX)) sa_error('Storage is busy. Try again.', 503);
    try {
        $path = sa_path($name);
        $data = is_file($path) ? json_decode((string)file_get_contents($path), true, 512, JSON_THROW_ON_ERROR) : $default;
        $next = $fn($data);
        if (!is_array($next)) sa_error('Invalid storage update.', 500);
        $temp = $path . '.' . bin2hex(random_bytes(6)) . '.tmp';
        $written = file_put_contents($temp, json_encode($next, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
        if ($written === false) sa_error('Could not save. Previous settings are unchanged.', 503);
        chmod($temp, 0600);
        if (!rename($temp, $path)) { @unlink($temp); sa_error('Could not finish saving.', 503); }
        return $next;
    } finally { flock($lock, LOCK_UN); fclose($lock); }
}
function sa_read(string $name, array $default = []): array {
    $path = sa_path($name);
    if (!is_file($path)) return $default;
    return json_decode((string)file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
}
function sa_json_file(string $path, array $default = []): array {
    if (!is_file($path)) return $default;
    $v = json_decode((string)file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
    return is_array($v) ? $v : $default;
}
function sa_text($value, int $max = 200): string {
    if (!is_string($value)) sa_error('Expected text.');
    $value = trim($value);
    if (strlen($value) > $max || preg_match('/[\x00-\x08\x0B-\x1F\x7F]/', $value)) sa_error('Text is too long or contains unsupported characters.');
    return $value;
}
function sa_id($value): string {
    $id = sa_text($value, 100);
    if (!preg_match('/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/', $id)) sa_error('Use letters, numbers, dashes and underscores for IDs.');
    return $id;
}
function sa_url($value): string {
    $url = sa_text($value, 2000);
    if ($url === '') return '';
    if (preg_match('~^https://~i', $url) && filter_var($url, FILTER_VALIDATE_URL) && !parse_url($url, PHP_URL_USER) && !parse_url($url, PHP_URL_PASS)) return $url;
    $decoded = rawurldecode($url);
    if (preg_match('~^(audio|music|uploads)/[a-zA-Z0-9_ .%/()&+,-]+$~', $url) && !preg_match('~(^|/)\.\.(/|$)|[\\\\?#]~', $decoded)) return $url;
    sa_error('Use an HTTPS URL or a path inside this site’s audio, music or uploads folder.');
}
function sa_limit(string $bucket, int $max, int $seconds): void {
    $key = hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? 'cli'));
    $blocked = false;
    sa_update('limits', function ($all) use ($bucket, $key, $max, $seconds, &$blocked) {
        $now = time();
        foreach ($all as $id => $v) if (($v['until'] ?? 0) <= $now) unset($all[$id]);
        $id = $bucket . '-' . $key;
        $entry = $all[$id] ?? ['count' => 0, 'until' => $now + $seconds];
        $blocked = $entry['count'] >= $max;
        if (!$blocked) $entry['count']++;
        $all[$id] = $entry;
        return $all;
    });
    if ($blocked) sa_error('Too many attempts. Try again later.', 429);
}
function sa_users(): array {
    return sa_read('users', [($GLOBALS['sa']['ownerUsername'] ?? 'jeremy') => ['name' => $GLOBALS['sa']['ownerName'] ?? 'Jeremy', 'role' => 'owner', 'hash' => '', 'enabled' => true]]);
}
function sa_hash(array $user): string {
    if ($user['hash'] ?? '') return $user['hash'];
    if (($user['role'] ?? '') === 'owner') return sa_json_file(sa_config('ownerHashFile'))['hash'] ?? '';
    return '';
}
function sa_session(): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    $dir = sa_config('dataDir') . '/sessions';
    if (!is_dir($dir) && !mkdir($dir, 0700, true)) sa_error('Session storage is unavailable.', 503);
    session_save_path($dir);
    session_name('sa_' . substr(hash('sha256', sa_config('id')), 0, 16));
    session_set_cookie_params(['lifetime' => 0, 'path' => sa_config('basePath') . 'admin/', 'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off', 'httponly' => true, 'samesite' => 'Strict']);
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.gc_maxlifetime', '43200');
    if (!session_start()) sa_error('Could not open your session.', 503);
}
function sa_login(string $username, string $password): array {
    sa_limit('login', 8, 900);
    $user = sa_users()[$username] ?? [];
    $hash = sa_hash($user);
    if (!$hash || !($user['enabled'] ?? false) || !password_verify($password, $hash)) sa_error('The username or password is incorrect.', 401);
    sa_session(); session_regenerate_id(true);
    $_SESSION = ['user' => $username, 'stamp' => hash('sha256', $hash), 'expires' => time() + 43200, 'csrf' => bin2hex(random_bytes(32))];
    return sa_identity();
}
function sa_identity(): array {
    sa_session();
    $user = sa_users()[$_SESSION['user'] ?? ''] ?? [];
    if (!$user || !($user['enabled'] ?? false) || ($_SESSION['expires'] ?? 0) < time() || !hash_equals($_SESSION['stamp'] ?? '', hash('sha256', sa_hash($user)))) {
        $_SESSION = []; sa_error('Please sign in.', 401);
    }
    return ['username' => $_SESSION['user'], 'name' => $user['name'], 'role' => $user['role'], 'csrf' => $_SESSION['csrf'], 'usesOwnerPassword' => empty($user['hash'])];
}
function sa_csrf(): void {
    if (!hash_equals($_SESSION['csrf'] ?? '', $_SERVER['HTTP_X_SITE_ADMIN_CSRF'] ?? '') || empty($_SESSION['csrf'])) sa_error('Please reload before saving.', 403);
}
function sa_body(): array {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') sa_error('Method not allowed.', 405);
    if (stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== 0) sa_error('Send JSON.', 415);
    if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 2000000) sa_error('Request is too large.', 413);
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin && parse_url($origin, PHP_URL_HOST) !== parse_url(sa_config('url'), PHP_URL_HOST) && $origin !== 'http://' . ($_SERVER['HTTP_HOST'] ?? '')) sa_error('Origin not allowed.', 403);
    $raw = file_get_contents('php://input', false, null, 0, 2000001);
    if (strlen($raw) > 2000000) sa_error('Request is too large.', 413);
    $data = json_decode($raw, true);
    if (!is_array($data)) sa_error('Invalid JSON.');
    return $data;
}
function sa_password($password): string {
    if (!is_string($password) || strlen($password) < 12 || strlen($password) > 72) sa_error('Use a password between 12 and 72 bytes.');
    return password_hash($password, PASSWORD_DEFAULT);
}
function sa_default_catalog(): array {
    $config = sa_json_file(sa_config('siteDir') . '/site.config.json');
    return ['revision' => 0, 'songs' => sa_json_file(sa_config('siteDir') . '/tracks.json'), 'albums' => $config['music']['albums'] ?? [], 'playlists' => [], 'policy' => ['explicit' => 'opt-in', 'defaultTypes' => ['instrumental','vocal','spoken']], 'changes' => []];
}
function sa_catalog(): array { return sa_read('catalog', sa_default_catalog()); }
function sa_normalize_catalog(array $data): array {
    $out = ['songs' => [], 'albums' => [], 'playlists' => []];
    foreach (['songs' => 5000, 'albums' => 200, 'playlists' => 200] as $key => $max) {
        if (!isset($data[$key]) || !is_array($data[$key]) || count($data[$key]) > $max) sa_error('Invalid ' . $key . ' list.');
        $seen = [];
        foreach ($data[$key] as $item) {
            if (!is_array($item)) sa_error('Invalid ' . $key . ' entry.');
            $id = sa_id($item['id'] ?? '');
            if (isset($seen[$id])) sa_error('Each ' . $key . ' ID must be unique.');
            $seen[$id] = true;
            $title = sa_text($item['title'] ?? '', 200);
            if (!$title) sa_error('Every song, album and playlist needs a title.');
            $row = ['id' => $id, 'title' => $title];
            if ($key === 'songs') {
                $row += ['url' => sa_url($item['url'] ?? ''), 'album' => empty($item['album']) ? '' : sa_id($item['album']), 'explicit' => ($item['explicit'] ?? false) === true, 'published' => ($item['published'] ?? true) === true];
                if ($row['published'] && !$row['url']) sa_error('Published songs need an audio URL.');
                $row['kind'] = $item['kind'] ?? 'vocal';
                if (!in_array($row['kind'], ['instrumental','vocal','spoken'], true)) sa_error('Choose a song type.');
                $row['language'] = sa_text($item['language'] ?? 'en', 35);
                if ($row['language'] && !preg_match('/^[a-zA-Z]{2,8}(-[a-zA-Z0-9]{1,8})*$/', $row['language'])) sa_error('Use a language code such as en or es.');
                $artists = $item['artists'] ?? [];
                if (!is_array($artists) || count($artists) > 20) sa_error('Invalid artists.');
                $row['artists'] = array_map(fn($v) => sa_text($v, 120), $artists);
                $row['bpm'] = isset($item['bpm']) && $item['bpm'] !== '' ? (float)$item['bpm'] : null;
                if ($row['bpm'] !== null && ($row['bpm'] < 0 || $row['bpm'] > 400)) sa_error('Tempo must be between 0 and 400.');
                $row['date'] = sa_text($item['date'] ?? '', 10);
                if ($row['date'] && !preg_match('/^\d{4}(-\d{2})?(-\d{2})?$/', $row['date'])) sa_error('Use a date such as 2026-11-03.');
                $row['versions'] = [];
                if (!is_array($item['versions'] ?? [])) sa_error('Invalid song versions.');
                foreach (array_slice($item['versions'] ?? [], 0, 20) as $v) $row['versions'][] = ['label' => sa_text($v['label'] ?? '', 80), 'url' => sa_url($v['url'] ?? '')];
            } elseif ($key === 'albums') {
                $row += ['artist' => sa_text($item['artist'] ?? '', 120), 'cover' => sa_url($item['cover'] ?? ''), 'color' => sa_text($item['color'] ?? '#e2ad4f', 7)];
                if (!preg_match('/^#[0-9a-f]{6}$/i', $row['color'])) sa_error('Use a six-digit album color.');
            } else {
                if (!is_array($item['trackIds'] ?? null)) sa_error('Invalid playlist songs.');
                $row['trackIds'] = array_values(array_unique(array_map('sa_id', $item['trackIds'])));
            }
            $out[$key][] = $row;
        }
    }
    $albumIds = array_column($out['albums'], 'id'); $songIds = array_column($out['songs'], 'id');
    foreach ($out['songs'] as $s) if ($s['album'] && !in_array($s['album'], $albumIds, true)) sa_error('A song points to an album that no longer exists.');
    foreach ($out['playlists'] as $p) if (array_diff($p['trackIds'], $songIds)) sa_error('A playlist points to a song that no longer exists.');
    $policy = $data['policy'] ?? [];
    if (!in_array($policy['explicit'] ?? '', ['opt-in','blocked'], true) || !is_array($policy['defaultTypes'] ?? null) || array_diff($policy['defaultTypes'], ['instrumental','vocal','spoken'])) sa_error('Invalid listening defaults.');
    $out['policy'] = ['explicit' => $policy['explicit'], 'defaultTypes' => array_values(array_unique($policy['defaultTypes']))];
    return $out;
}
function sa_public_catalog(array $query): array {
    $c = sa_catalog();
    $types = isset($query['types']) ? explode(',', (string)$query['types']) : $c['policy']['defaultTypes'];
    $allow = ($query['explicit'] ?? '') === '1' && $c['policy']['explicit'] === 'opt-in';
    $tracks = array_values(array_filter($c['songs'], fn($t) => ($t['published'] ?? true) && (!($t['explicit'] ?? false) || $allow) && in_array($t['kind'] ?? 'vocal', $types, true)));
    $ids = array_column($tracks, 'id');
    $config = sa_json_file(sa_config('siteDir') . '/site.config.json');
    $config['music']['albums'] = $c['albums'];
    $playlists = array_map(function ($p) use ($ids) { $p['trackIds'] = array_values(array_intersect($p['trackIds'], $ids)); return $p; }, $c['playlists']);
    return ['config' => $config, 'tracks' => $tracks, 'playlists' => $playlists, 'policy' => $c['policy'], 'revision' => $c['revision']];
}
function sa_report_defaults(): array {
    return ['revision' => 0, 'enabled' => false, 'to' => [], 'frequency' => 'weekly', 'time' => '09:00', 'weekday' => 1, 'timezone' => 'America/New_York', 'sections' => ['songs','changes'], 'note' => '', 'nextAt' => 0, 'lastAttempt' => 0, 'lastAccepted' => 0, 'status' => 'Not sent', 'history' => []];
}
function sa_next_time(array $s, int $after): int {
    $tz = new DateTimeZone($s['timezone']);
    $now = (new DateTimeImmutable('@' . $after))->setTimezone($tz);
    [$hour,$minute] = array_map('intval', explode(':', $s['time']));
    for ($day = 0; $day <= 8; $day++) {
        $slot = $now->modify('+' . $day . ' days')->setTime($hour, $minute);
        if ($slot->getTimestamp() > $after && ($s['frequency'] === 'daily' || (int)$slot->format('N') === $s['weekday'])) return $slot->getTimestamp();
    }
    sa_error('Could not calculate schedule.', 500);
}
function sa_normalize_report(array $in): array {
    $out = ['enabled' => ($in['enabled'] ?? false) === true, 'frequency' => $in['frequency'] ?? '', 'time' => $in['time'] ?? '', 'weekday' => (int)($in['weekday'] ?? 1), 'timezone' => $in['timezone'] ?? '', 'to' => [], 'sections' => $in['sections'] ?? [], 'note' => sa_text($in['note'] ?? '', 2000)];
    if (!in_array($out['frequency'], ['daily','weekly'], true) || !preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $out['time']) || $out['weekday'] < 1 || $out['weekday'] > 7 || !in_array($out['timezone'], DateTimeZone::listIdentifiers(), true)) sa_error('Choose a valid schedule and timezone.');
    if (!is_array($in['to'] ?? null) || count($in['to']) > 5) sa_error('Choose up to five report recipients.');
    foreach ($in['to'] as $email) {
        $email = sa_text($email, 254);
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) sa_error('Check the report email addresses.');
        $out['to'][] = $email;
    }
    $out['to'] = array_values(array_unique($out['to']));
    if ($out['enabled'] && !$out['to']) sa_error('Add a recipient before enabling reports.');
    if (!is_array($out['sections']) || array_diff($out['sections'], ['songs','changes']) || !$out['sections']) sa_error('Choose at least one report section.');
    return $out;
}
function sa_count(int $value, string $unit): string { return $value . ' ' . $unit . ($value === 1 ? '' : 's'); }
function sa_report(array $s): array {
    $c = sa_catalog(); $days = $s['frequency'] === 'daily' ? 1 : 7; $since = time() - $days * 86400;
    $stats = sa_read('plays'); $counts = [];
    foreach ($stats as $day => $values) if (strtotime($day . ' UTC') >= strtotime(gmdate('Y-m-d', time() - ($days - 1) * 86400) . ' UTC')) foreach ($values as $id => $count) $counts[$id] = ($counts[$id] ?? 0) + $count;
    arsort($counts); $byId = array_column($c['songs'], null, 'id');
    $lines = [sa_config('name') . ' — site update', 'Prepared ' . (new DateTimeImmutable('now', new DateTimeZone($s['timezone'])))->format('M j, Y H:i T'), ''];
    if ($s['note']) { $lines[] = $s['note']; $lines[] = ''; }
    if (in_array('songs', $s['sections'], true)) {
        $lines[] = sa_count(count($c['songs']), 'song') . ' · ' . sa_count(count($c['albums']), 'album') . ' · ' . sa_count(count($c['playlists']), 'playlist');
        $lines[] = sa_count(array_sum($counts), 'measured play') . ' in the recent ' . $days . ' day' . ($days > 1 ? 's' : '') . ' (UTC day totals; counted after five seconds).';
        foreach (array_slice($counts, 0, 8, true) as $id => $count) if (isset($byId[$id])) $lines[] = $byId[$id]['title'] . ': ' . $count;
        $lines[] = 'Play counts are approximate browser activity, not royalty accounting.'; $lines[] = '';
    }
    if (in_array('changes', $s['sections'], true)) {
        $lines[] = 'Recent catalog updates'; $found = false;
        foreach ($c['changes'] as $change) if ($change['at'] >= $since) { $found = true; $lines[] = gmdate('M j H:i', $change['at']) . ' UTC — ' . $change['actor'] . ': ' . $change['summary']; }
        if (!$found) $lines[] = 'No catalog updates in this period.';
    }
    $lines[] = ''; $lines[] = sa_config('url');
    $text = implode("\n", $lines);
    $html = '<!doctype html><html><body style="background:#f3f0e9;padding:24px;font:16px/1.6 Arial;color:#252326"><div style="max-width:620px;margin:auto;background:#fff;padding:30px;border-top:5px solid #b58a36"><h1 style="font-size:26px">' . htmlspecialchars(sa_config('name'), ENT_QUOTES, 'UTF-8') . '</h1><div style="white-space:pre-wrap">' . htmlspecialchars($text, ENT_QUOTES, 'UTF-8') . '</div></div></body></html>';
    return ['subject' => sa_config('name') . ' · Site update', 'text' => $text, 'html' => $html];
}
function sa_send(array $s): array {
    if (!$s['to']) sa_error('Save a recipient before sending a test.');
    $report = sa_report($s); $results = [];
    foreach ($s['to'] as $to) {
        if ((sa_config('mailMode')) === 'capture') {
            $path = sa_config('dataDir') . '/test-mail-' . bin2hex(random_bytes(6)) . '.html';
            $ok = file_put_contents($path, $report['html']) !== false;
        } else {
            $headers = ['From: ' . sa_config('mailFrom'), 'MIME-Version: 1.0', 'Content-Type: text/html; charset=UTF-8'];
            $subject = '=?UTF-8?B?' . base64_encode($report['subject']) . '?=';
            $ok = @mail($to, $subject, $report['html'], implode("\r\n", $headers));
        }
        $results[] = ['to' => $to, 'accepted' => $ok];
    }
    return ['ok' => !in_array(false, array_column($results, 'accepted'), true), 'results' => $results, 'captured' => sa_config('mailMode') === 'capture'];
}
function sa_run_mail(bool $test = false): array {
    $lock = fopen(sa_path('send') . '.lock', 'c');
    if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) sa_error('A report is already being processed.', 409);
    try {
        $now = time(); $s = null;
        sa_update('reports', function ($current) use ($test, $now, &$s) {
            if (!$test && (!$current['enabled'] || !$current['nextAt'] || $current['nextAt'] > $now)) return $current;
            if (!$current['to']) sa_error('Save a report recipient first.');
            $s = $current; // Claim the current recipient/settings snapshot while holding its lock.
            $current['lastAttempt'] = $now; $current['status'] = 'Sending; delivery not yet known';
            if (!$test) $current['nextAt'] = sa_next_time($current, $now);
            return $current;
        }, sa_report_defaults());
        if ($s === null) return ['due' => false];
        $result = sa_send($s);
        sa_update('reports', function ($current) use ($result, $now, $test) {
            $current['status'] = $result['captured'] ? 'Captured locally; no email sent' : ($result['ok'] ? 'Accepted by mail server; inbox delivery unverified' : 'One or more messages were refused by the mail server');
            if ($result['ok'] && !$result['captured']) $current['lastAccepted'] = $now;
            array_unshift($current['history'], ['at' => $now, 'test' => $test, 'status' => $current['status'], 'results' => $result['results']]);
            $current['history'] = array_slice($current['history'], 0, 30);
            return $current;
        }, sa_report_defaults());
        return $result;
    } finally { flock($lock, LOCK_UN); fclose($lock); }
}
function sa_scan(): array {
    $songs = []; $root = realpath(sa_config('siteDir'));
    foreach (['audio','music'] as $folder) {
        $path = $root . '/' . $folder; if (!is_dir($path)) continue;
        $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($path, FilesystemIterator::SKIP_DOTS));
        foreach ($it as $file) {
            if (count($songs) >= 5000) break;
            if (!$file->isFile() || $file->isLink() || !preg_match('/\.(mp3|m4a|ogg|wav|flac)$/i', $file->getFilename())) continue;
            $real = $file->getRealPath(); if (strpos($real, $root . '/' . $folder . '/') !== 0) continue;
            $relative = substr($real, strlen($root) + 1);
            $url = implode('/', array_map('rawurlencode', explode('/', $relative)));
            $songs[] = ['id' => 'song-' . substr(hash('sha256', $relative), 0, 16), 'title' => pathinfo($relative, PATHINFO_FILENAME), 'url' => $url, 'artists' => [sa_config('artist')], 'album' => '', 'kind' => 'vocal', 'language' => 'en', 'explicit' => false, 'published' => false, 'versions' => []];
        }
    }
    return $songs;
}
function sa_dispatch(): void {
    try {
        $method = $_SERVER['REQUEST_METHOD'] ?? 'GET'; $action = $_GET['action'] ?? 'session';
        if ($method === 'GET' && $action === 'catalog') sa_reply(sa_public_catalog($_GET));
        $input = $method === 'POST' ? sa_body() : [];
        if ($method === 'POST' && $action === 'play') {
            sa_limit('play', 120, 3600); $id = sa_id($input['id'] ?? '');
            $c = sa_catalog(); $songs = array_column($c['songs'], null, 'id');
            if (!isset($songs[$id]) || !($songs[$id]['published'] ?? true)) sa_error('Unknown song.', 404);
            sa_update('plays', function ($all) use ($id) {
                $day = gmdate('Y-m-d');
                $all[$day][$id] = ($all[$day][$id] ?? 0) + 1;
                foreach ($all as $date => $v) if ($date < gmdate('Y-m-d', time() - 90 * 86400)) unset($all[$date]);
                return $all;
            });
            sa_reply(['ok' => true]);
        }
        if ($method === 'POST' && $action === 'login') {
            $password = $input['password'] ?? '';
            if (!is_string($password) || strlen($password) > 200) sa_error('Invalid password.');
            sa_reply(['user' => sa_login(sa_text($input['username'] ?? '', 40), $password)]);
        }
        if ($method === 'POST' && $action === 'activate') {
            sa_limit('activate', 8, 900); $token = sa_text($input['token'] ?? '', 100); $hash = sa_password($input['password'] ?? ''); $activated = '';
            sa_update('users', function ($users) use ($token, $hash, &$activated) {
                foreach ($users as $id => &$user) if (!empty($user['inviteHash']) && ($user['inviteExpires'] ?? 0) > time() && hash_equals($user['inviteHash'], hash('sha256', $token))) {
                    $user['hash'] = $hash; $user['enabled'] = true; unset($user['inviteHash'], $user['inviteExpires']); $activated = $id; break;
                }
                if (!$activated) sa_error('This activation code is invalid or expired. Ask the site owner for a new one.', 400);
                return $users;
            }, sa_users());
            sa_reply(['ok' => true, 'username' => $activated]);
        }
        $user = sa_identity();
        if ($method === 'GET') {
            if ($action === 'session') sa_reply(['user' => $user, 'site' => ['name' => sa_config('name'), 'artist' => sa_config('artist'), 'url' => sa_config('url')]]);
            if ($action === 'state') sa_reply(['site' => ['name' => sa_config('name'), 'artist' => sa_config('artist')], 'catalog' => sa_catalog(), 'reports' => sa_read('reports', sa_report_defaults()), 'schedulerLastRun' => sa_read('scheduler')['lastRun'] ?? 0, 'cron' => 'php ' . escapeshellarg(sa_config('cronFile')), 'mailFrom' => sa_config('mailFrom')]);
            if ($action === 'preview') sa_reply(sa_report(sa_read('reports', sa_report_defaults())));
            if ($action === 'scan') sa_reply(['songs' => sa_scan()]);
            if ($action === 'users' && $user['role'] === 'owner') sa_reply(['users' => array_map(fn($id,$u) => ['username' => $id, 'name' => $u['name'], 'role' => $u['role'], 'enabled' => $u['enabled'], 'pending' => !empty($u['inviteHash'])], array_keys(sa_users()), array_values(sa_users()))]);
            sa_error('Not found.', 404);
        }
        sa_csrf();
        if ($action === 'logout') { $_SESSION = []; session_destroy(); sa_reply(['ok' => true]); }
        if ($action === 'password') {
            sa_limit('password', 8, 900);
            $hash = sa_password($input['password'] ?? '');
            if (!password_verify((string)($input['current'] ?? ''), sa_hash(sa_users()[$user['username']]))) sa_error('Current password is incorrect.', 401);
            sa_update('users', function ($users) use ($user,$hash) { $users[$user['username']]['hash'] = $hash; return $users; }, sa_users());
            session_regenerate_id(true); $_SESSION['stamp'] = hash('sha256', $hash); $_SESSION['csrf'] = bin2hex(random_bytes(32));
            sa_reply(['user' => sa_identity()]);
        }
        if ($action === 'save-catalog') {
            $next = sa_normalize_catalog($input['catalog'] ?? []);
            $saved = sa_update('catalog', function ($old) use ($next,$input,$user) {
                if (($input['revision'] ?? null) !== $old['revision']) sa_error('Someone else changed the catalog. Reload before saving.', 409);
                $changes = $old['changes'];
                $summary = sa_count(count($next['songs']), 'song') . ', ' . sa_count(count($next['albums']), 'album') . ', ' . sa_count(count($next['playlists']), 'playlist') . ' saved';
                array_unshift($changes, ['at' => time(), 'actor' => $user['name'], 'summary' => $summary]);
                return $next + ['revision' => $old['revision'] + 1, 'changes' => array_slice($changes, 0, 250)];
            }, sa_default_catalog());
            sa_reply(['catalog' => $saved]);
        }
        if ($action === 'save-reports') {
            $next = sa_normalize_report($input['reports'] ?? []);
            $saved = sa_update('reports', function ($old) use ($next,$input) {
                if (($input['revision'] ?? null) !== $old['revision']) sa_error('The report settings changed. Reload before saving.', 409);
                $scheduleChanged = !$old['enabled'];
                foreach (['frequency','time','weekday','timezone'] as $key) if ($next[$key] !== $old[$key]) $scheduleChanged = true;
                $out = array_replace($old, $next); $out['revision']++;
                $out['nextAt'] = !$out['enabled'] ? 0 : ($scheduleChanged || !$old['nextAt'] ? sa_next_time($out, time()) : $old['nextAt']);
                return $out;
            }, sa_report_defaults());
            sa_reply(['reports' => $saved]);
        }
        if ($action === 'test-report') { sa_limit('test-mail', 5, 3600); sa_reply(sa_run_mail(true)); }
        if ($user['role'] !== 'owner') sa_error('Only the site owner can manage access.', 403);
        if ($action === 'invite') {
            $id = strtolower(sa_id($input['username'] ?? '')); $name = sa_text($input['name'] ?? '', 100);
            if (!$name || strlen($id) > 40) sa_error('Choose a short username and name.');
            $token = bin2hex(random_bytes(24));
            sa_update('users', function ($users) use ($id,$name,$token) {
                if (($users[$id]['role'] ?? '') === 'owner') sa_error('The owner account cannot be replaced.');
                if (!isset($users[$id]) && count($users) >= 20) sa_error('This site supports up to 20 administrators.');
                $users[$id] = ['name' => $name, 'role' => 'admin', 'enabled' => false, 'hash' => '', 'inviteHash' => hash('sha256', $token), 'inviteExpires' => time() + 172800];
                return $users;
            }, sa_users());
            sa_reply(['username' => $id, 'activationUrl' => rtrim(sa_config('url'), '/') . '/admin/#activate=' . $token]);
        }
        if ($action === 'disable-user') {
            $id = sa_id($input['username'] ?? '');
            sa_update('users', function ($users) use ($id) {
                if (!isset($users[$id]) || $users[$id]['role'] === 'owner') sa_error('Choose a site administrator account.');
                $users[$id]['enabled'] = false; unset($users[$id]['inviteHash'], $users[$id]['inviteExpires']); return $users;
            }, sa_users());
            sa_reply(['ok' => true]);
        }
        sa_error('Not found.', 404);
    } catch (Throwable $error) {
        $code = $error->getCode(); $expected = $error instanceof RuntimeException && $code >= 400 && $code < 500;
        if (!$expected) error_log('Site Admin: ' . $error->getMessage());
        sa_reply(['error' => $expected ? $error->getMessage() : 'The server could not complete that request. Check the host error log.'], $expected ? $code : 503);
    }
}
