<?php
// Shared helpers for jerm747.games: game list, visitor stats, email reports, admin sign-in.
// Storage is plain JSON files in api/data (blocked from the web by .htaccess).

declare(strict_types=1);

const SITE_URL = 'https://jerm747.games';
const ADMIN_EMAIL = 'admin@jerm747.dev';
const MAIL_FROM = 'admin@jerm747.dev'; // must be a mailbox on your hosting account

function data_dir(string $sub = ''): string {
    $dir = __DIR__ . '/data' . ($sub ? '/' . $sub : '');
    if (!is_dir($dir)) mkdir($dir, 0750, true);
    return $dir;
}

function respond($payload, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function fail(string $message, int $status = 400): void {
    respond(['ok' => false, 'error' => $message], $status);
}

function body_json(): array {
    $raw = file_get_contents('php://input') ?: '';
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function clean(?string $s, int $max = 5000): string {
    $s = trim((string)$s);
    $s = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/u', '', $s) ?? '';
    return mb_substr($s, 0, $max);
}

function now(): string {
    return gmdate('c');
}

function send_mail(string $to, string $subject, string $text, ?string $replyTo = null): bool {
    if (!filter_var($to, FILTER_VALIDATE_EMAIL)) return false;
    $headers = [
        'From: jerm747.games <' . MAIL_FROM . '>',
        'Reply-To: ' . ($replyTo && filter_var($replyTo, FILTER_VALIDATE_EMAIL) ? $replyTo : ADMIN_EMAIL),
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
    ];
    $subject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
    $ok = @mail($to, $subject, $text, implode("\r\n", $headers), '-f' . MAIL_FROM);
    if (!$ok) error_log("jerm747.dev mail to $to failed");
    return (bool)$ok;
}

// Simple per-IP limiter so project keys can't be guessed by brute force.
function rate_limit(string $bucket, int $max, int $windowSeconds): void {
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $file = data_dir('ratelimit') . '/' . $bucket . '-' . hash('sha256', $ip) . '.json';
    $hits = is_file($file) ? (json_decode((string)file_get_contents($file), true) ?: []) : [];
    $cutoff = time() - $windowSeconds;
    $hits = array_values(array_filter($hits, fn($t) => $t > $cutoff));
    if (count($hits) >= $max) fail('Too many attempts. Wait a few minutes and try again.', 429);
    $hits[] = time();
    file_put_contents($file, json_encode($hits), LOCK_EX);
}

// Admin password lives as a hash in data/admin.json. First visit to the admin page sets it.
function admin_hash(): ?string {
    $file = data_dir() . '/admin.json';
    if (!is_file($file)) return null;
    $d = json_decode((string)file_get_contents($file), true);
    return $d['hash'] ?? null;
}

function require_admin(): void {
    $hash = admin_hash();
    $given = $_SERVER['HTTP_X_ADMIN_PASSWORD'] ?? ($_POST['password'] ?? '');
    if (!$hash) fail('Admin password not set yet.', 403);
    rate_limit('admin', 30, 900);
    if (!password_verify((string)$given, $hash)) fail('Wrong admin password.', 401);
}

// ---------------------------------------------------------------------------
// Visitor analytics. No cookies: a visitor is a hash of IP + browser with a salt
// that changes every day, so nobody can be followed across days or identified.
// ---------------------------------------------------------------------------

function settings(): array {
    $file = data_dir() . '/settings.json';
    $s = is_file($file) ? (json_decode((string)file_get_contents($file), true) ?: []) : [];
    $s += ['report_hours' => 24, 'last_report' => 0, 'report_token' => ''];
    if ($s['report_token'] === '') {
        $s['report_token'] = bin2hex(random_bytes(16));
        if (!$s['last_report']) $s['last_report'] = time(); // first report one interval after launch
        save_settings($s);
    }
    return $s;
}

function save_settings(array $s): void {
    file_put_contents(data_dir() . '/settings.json', json_encode($s, JSON_PRETTY_PRINT), LOCK_EX);
}

function day_salt(string $day): string {
    $file = data_dir('analytics') . "/salt-$day";
    if (!is_file($file)) {
        file_put_contents($file, bin2hex(random_bytes(16)), LOCK_EX);
        foreach (glob(data_dir('analytics') . '/salt-*') as $old) {
            if ($old !== $file && filemtime($old) < time() - 3 * 86400) @unlink($old);
        }
    }
    return (string)file_get_contents($file);
}

function is_bot(string $ua): bool {
    return $ua === '' || (bool)preg_match('/bot|crawl|spider|slurp|preview|monitor|curl|wget|python|headless|lighthouse|facebookexternalhit/i', $ua);
}

function device_of(string $ua): string {
    if (preg_match('/iPad|Tablet|Android(?!.*Mobile)/i', $ua)) return 'tablet';
    if (preg_match('/Mobi|iPhone|Android/i', $ua)) return 'phone';
    return 'desktop';
}

function browser_of(string $ua): string {
    foreach (['Edg' => 'Edge', 'OPR' => 'Opera', 'SamsungBrowser' => 'Samsung', 'Firefox' => 'Firefox', 'CriOS' => 'Chrome', 'Chrome' => 'Chrome', 'Safari' => 'Safari'] as $needle => $name) {
        if (str_contains($ua, $needle)) return $name;
    }
    return 'Other';
}

function record_event(string $type, string $path, string $ref, string $project = ''): void {
    $ua = (string)($_SERVER['HTTP_USER_AGENT'] ?? '');
    if (is_bot($ua)) return;
    $day = gmdate('Y-m-d');
    $visitor = substr(hash('sha256', day_salt($day) . ($_SERVER['REMOTE_ADDR'] ?? '') . $ua), 0, 12);
    $refHost = '';
    if ($ref !== '') {
        $host = strtolower((string)parse_url($ref, PHP_URL_HOST));
        if ($host !== '' && !str_ends_with($host, 'jerm747.dev')) $refHost = preg_replace('/^www\./', '', $host);
    }
    $row = [
        't' => time(), 'v' => $visitor, 'type' => $type,
        'path' => mb_substr($path, 0, 120), 'ref' => $refHost,
        'dev' => device_of($ua), 'br' => browser_of($ua),
    ];
    if ($project !== '') $row['p'] = mb_substr($project, 0, 80);
    file_put_contents(data_dir('analytics') . "/$day.jsonl", json_encode($row, JSON_UNESCAPED_SLASHES) . "\n", FILE_APPEND | LOCK_EX);
}

function read_events(int $sinceTs): array {
    $rows = [];
    for ($d = strtotime(gmdate('Y-m-d', $sinceTs)); $d <= time(); $d += 86400) {
        $file = data_dir('analytics') . '/' . gmdate('Y-m-d', $d) . '.jsonl';
        if (!is_file($file)) continue;
        foreach (file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
            $r = json_decode($line, true);
            if (is_array($r) && $r['t'] >= $sinceTs) $rows[] = $r;
        }
    }
    return $rows;
}

function top_counts(array $values, int $limit = 8): array {
    $c = array_count_values(array_filter($values, fn($v) => $v !== '' && $v !== null));
    arsort($c);
    $out = [];
    foreach (array_slice($c, 0, $limit, true) as $k => $n) $out[] = ['name' => (string)$k, 'count' => $n];
    return $out;
}

function build_stats(int $days, string $tz = 'America/New_York'): array {
    $zone = new DateTimeZone($tz);
    $since = time() - $days * 86400;
    $rows = read_events($since);
    $views = array_values(array_filter($rows, fn($r) => $r['type'] === 'view'));
    $launches = array_values(array_filter($rows, fn($r) => $r['type'] === 'launch'));

    $daily = [];
    for ($i = $days - 1; $i >= 0; $i--) {
        $key = (new DateTime('@' . (time() - $i * 86400)))->setTimezone($zone)->format('Y-m-d');
        $daily[$key] = ['date' => $key, 'views' => 0, 'visitors' => []];
    }
    foreach ($views as $r) {
        $key = (new DateTime('@' . $r['t']))->setTimezone($zone)->format('Y-m-d');
        if (!isset($daily[$key])) continue;
        $daily[$key]['views']++;
        $daily[$key]['visitors'][$r['v']] = true;
    }
    $daily = array_values(array_map(fn($d) => ['date' => $d['date'], 'views' => $d['views'], 'visitors' => count($d['visitors'])], $daily));

    $hourly = [];
    $dayAgo = time() - 86400;
    for ($i = 23; $i >= 0; $i--) {
        $h = (new DateTime('@' . (time() - $i * 3600)))->setTimezone($zone)->format('Y-m-d H');
        $hourly[$h] = ['hour' => $h, 'views' => 0];
    }
    $last24 = array_filter($views, fn($r) => $r['t'] >= $dayAgo);
    foreach ($last24 as $r) {
        $h = (new DateTime('@' . $r['t']))->setTimezone($zone)->format('Y-m-d H');
        if (isset($hourly[$h])) $hourly[$h]['views']++;
    }

    return [
        'days' => $days,
        'totals' => [
            'views' => count($views),
            'visitors' => count(array_unique(array_map(fn($r) => $r['v'] . gmdate('Ymd', $r['t']), $views))),
            'launches' => count($launches),
            'views24' => count($last24),
            'visitors24' => count(array_unique(array_map(fn($r) => $r['v'], $last24))),
        ],
        'daily' => $daily,
        'hourly' => array_values($hourly),
        'pages' => top_counts(array_map(fn($r) => $r['path'], $views)),
        'referrers' => top_counts(array_map(fn($r) => $r['ref'], $views)),
        'devices' => top_counts(array_map(fn($r) => $r['dev'], $views)),
        'browsers' => top_counts(array_map(fn($r) => $r['br'], $views)),
        'games' => top_counts(array_map(fn($r) => $r['p'] ?? '', $launches)),
    ];
}

function report_text(int $hours): string {
    $since = time() - $hours * 3600;
    $rows = read_events($since);
    $views = array_filter($rows, fn($r) => $r['type'] === 'view');
    $launches = array_filter($rows, fn($r) => $r['type'] === 'launch');
    $visitors = count(array_unique(array_map(fn($r) => $r['v'], $views)));
    $lines = [];
    $lines[] = "jerm747.games, last $hours hours";
    $lines[] = '';
    $lines[] = "Visitors: $visitors";
    $lines[] = 'Page views: ' . count($views);
    $lines[] = 'Games opened: ' . count($launches);
    $list = function (string $title, array $items) use (&$lines) {
        if (!$items) return;
        $lines[] = '';
        $lines[] = $title;
        foreach ($items as $i) $lines[] = "  {$i['count']}  {$i['name']}";
    };
    $list('Came from', top_counts(array_map(fn($r) => $r['ref'], $views), 6));
    $list('Most played', top_counts(array_map(fn($r) => $r['p'] ?? '', $launches), 6));
    $list('Devices', top_counts(array_map(fn($r) => $r['dev'], $views), 3));
    $lines[] = '';
    $lines[] = 'Full traffic: ' . SITE_URL . '/#/admin';
    return implode("\n", $lines) . "\n";
}

// Sends the report if one is due. Called by cron (report.php) and, as a backup, by visits.
function maybe_send_report(bool $force = false): bool {
    $s = settings();
    $hours = (int)$s['report_hours'];
    if ($hours <= 0 && !$force) return false;
    $hours = $hours > 0 ? $hours : 24;
    if (!$force && time() - (int)$s['last_report'] < $hours * 3600 - 300) return false;
    $lock = fopen(data_dir() . '/report.lock', 'c');
    if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) return false;
    $s = settings();
    if (!$force && time() - (int)$s['last_report'] < $hours * 3600 - 300) { flock($lock, LOCK_UN); return false; }
    $sent = send_mail(ADMIN_EMAIL, 'jerm747.games traffic report, ' . (new DateTime('now', new DateTimeZone('America/New_York')))->format('M j, g:i a'), report_text($hours));
    $s['last_report'] = time();
    save_settings($s);
    flock($lock, LOCK_UN);
    return $sent;
}
