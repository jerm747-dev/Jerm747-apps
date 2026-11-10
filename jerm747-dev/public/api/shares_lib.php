<?php
// Shared private pages: a password-protected folder like sites/your-share-folder/ that you
// hand to people outside the site. Each page quietly logs visits, downloads and console opens
// here, so the admin "Shared" tab and your email show whether the link was used.
// Visitors never see any of this.
//
// Storage: api/data/shares/<id>.json   settings (title, expiry, notifications, taken down?)
//          api/data/shares/<id>.jsonl  one line per visit / download / console open

declare(strict_types=1);
require_once __DIR__ . '/lib.php';

const SHARE_DEFAULT_DAYS = 30;
const SHARE_TYPES = ['visit', 'download', 'console'];

function share_id_ok(string $id): bool {
    return (bool)preg_match('/^[a-z0-9][a-z0-9-]{2,63}$/', $id);
}

function share_file(string $id, string $ext): string {
    if (!share_id_ok($id)) throw new InvalidArgumentException('Bad share id');
    return data_dir('shares') . "/$id.$ext";
}

function share_load(string $id): ?array {
    if (!share_id_ok($id)) return null;
    $f = share_file($id, 'json');
    if (!is_file($f)) return null;
    $s = json_decode((string)file_get_contents($f), true);
    return is_array($s) ? $s : null;
}

function share_save(array $s): void {
    file_put_contents(share_file($s['id'], 'json'), json_encode($s, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), LOCK_EX);
}

// Read-modify-write one share under a lock, so two visits at once can't both send "first visit".
function share_update(string $id, callable $fn): ?array {
    $lock = fopen(share_file($id, 'lock'), 'c');
    if (!$lock) return null;
    flock($lock, LOCK_EX);
    $s = share_load($id);
    if ($s !== null) { $s = $fn($s); share_save($s); }
    flock($lock, LOCK_UN);
    fclose($lock);
    return $s;
}

// Called by the share page on every load: creates the share record the first time it's seen.
function share_register(string $id, string $title, string $path): array {
    $existing = share_load($id);
    if ($existing) return $existing;
    $s = [
        'id' => $id, 'title' => clean($title, 140) ?: $id, 'path' => $path,
        'created' => now(), 'expires' => gmdate('c', time() + SHARE_DEFAULT_DAYS * 86400),
        'active' => true, 'taken_down' => null,
        'notify_first_visit' => true, 'notify_first_download' => true, 'notify_downloads' => false,
        'first_visit' => null, 'first_download' => null, 'reminded' => null,
    ];
    share_save($s);
    return $s;
}

// A taken-down share answers 410 Gone on every page and download, without deleting files.
function share_gate(string $id): void {
    $s = share_load($id);
    if ($s && empty($s['active'])) {
        http_response_code(410);
        header('Content-Type: text/html; charset=utf-8');
        header('Cache-Control: no-store');
        echo '<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>No longer available</title>'
           . '<body style="font:16px/1.5 system-ui,sans-serif;max-width:36rem;margin:15vh auto;padding:0 20px;color:#333">'
           . '<h1 style="font-size:1.4rem">This page is no longer available</h1>'
           . '<p>The link has been taken down. If you still need the files, contact the person who shared it.</p></body>';
        exit;
    }
}

// Your own visits don't count once you tick "Don't count my own visits" on the admin page.
function share_should_skip(): bool {
    return (($_COOKIE['j747_nocount'] ?? '') === '1') || is_bot((string)($_SERVER['HTTP_USER_AGENT'] ?? ''));
}

function share_user(): string {
    foreach (['PHP_AUTH_USER', 'REMOTE_USER', 'REDIRECT_REMOTE_USER'] as $k) {
        if (!empty($_SERVER[$k])) return clean((string)$_SERVER[$k], 60);
    }
    return '';
}

// One person = a hash of IP + browser, salted per site. Shows "3 people" without storing addresses.
function share_visitor(): string {
    $s = settings();
    if (empty($s['share_salt'])) { $s['share_salt'] = bin2hex(random_bytes(16)); save_settings($s); }
    return substr(hash('sha256', $s['share_salt'] . ($_SERVER['REMOTE_ADDR'] ?? '') . ($_SERVER['HTTP_USER_AGENT'] ?? '')), 0, 10);
}

function share_hit(string $id, string $type, array $extra = []): void {
    if (!in_array($type, SHARE_TYPES, true) || share_should_skip() || !share_load($id)) return;
    $ua = (string)($_SERVER['HTTP_USER_AGENT'] ?? '');
    $row = ['t' => time(), 'type' => $type, 'v' => share_visitor(), 'dev' => device_of($ua), 'br' => browser_of($ua)];
    $user = share_user();
    if ($user !== '') $row['user'] = $user;
    if (!empty($extra['file'])) $row['file'] = clean((string)$extra['file'], 120);
    file_put_contents(share_file($id, 'jsonl'), json_encode($row, JSON_UNESCAPED_SLASHES) . "\n", FILE_APPEND | LOCK_EX);

    // Emails: first visit, first download, and (optionally) every download
    $mail = [];
    share_update($id, function (array $s) use ($type, $row, &$mail) {
        if ($type === 'visit' && empty($s['first_visit'])) {
            $s['first_visit'] = now();
            if (!empty($s['notify_first_visit'])) $mail[] = 'first visit';
        }
        if ($type === 'download') {
            if (empty($s['first_download'])) {
                $s['first_download'] = now();
                if (!empty($s['notify_first_download'])) $mail[] = 'first download';
            } elseif (!empty($s['notify_downloads'])) {
                $mail[] = 'download';
            }
        }
        return $s;
    });
    foreach ($mail as $what) share_send_hit_mail($id, $what, $row);
    maybe_share_reminders();
}

function share_events(string $id): array {
    $f = share_file($id, 'jsonl');
    if (!is_file($f)) return [];
    $rows = [];
    foreach (file($f, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $r = json_decode($line, true);
        if (is_array($r)) $rows[] = $r;
    }
    return $rows;
}

function share_local_time($ts): string {
    $d = new DateTime('@' . (is_numeric($ts) ? (int)$ts : strtotime((string)$ts)));
    $d->setTimezone(new DateTimeZone('America/New_York'));
    return $d->format('M j, g:i a');
}

function share_summary(array $s): array {
    $rows = share_events($s['id']);
    $by = fn($t) => array_values(array_filter($rows, fn($r) => $r['type'] === $t));
    $visits = $by('visit'); $downloads = $by('download'); $console = $by('console');
    $last = fn($list) => $list ? gmdate('c', (int)end($list)['t']) : null;
    $daysLeft = (int)floor((strtotime($s['expires']) - time()) / 86400);
    return $s + [
        'url' => SITE_URL . $s['path'],
        'days_left' => $daysLeft,
        'due' => !empty($s['active']) && strtotime($s['expires']) <= time(),
        'stats' => [
            'visits' => count($visits),
            'people' => count(array_unique(array_map(fn($r) => $r['v'], $rows))),
            'downloads' => count($downloads),
            'console' => count($console),
            'last_visit' => $last($visits),
            'last_download' => $last($downloads),
            'files' => top_counts(array_map(fn($r) => $r['file'] ?? '', $downloads), 10),
            'users' => top_counts(array_map(fn($r) => $r['user'] ?? '', $rows), 10),
        ],
        'recent' => array_map(fn($r) => [
            'at' => gmdate('c', (int)$r['t']), 'type' => $r['type'], 'file' => $r['file'] ?? '',
            'user' => $r['user'] ?? '', 'device' => $r['dev'] . ' · ' . $r['br'], 'person' => $r['v'],
        ], array_slice(array_reverse($rows), 0, 30)),
    ];
}

function share_list(): array {
    $out = [];
    foreach (glob(data_dir('shares') . '/*.json') as $f) {
        $s = share_load(basename($f, '.json'));
        if ($s) $out[] = share_summary($s);
    }
    usort($out, fn($a, $b) => strcmp($b['created'], $a['created']));
    return $out;
}

function share_stats_line(array $sum): string {
    $st = $sum['stats'];
    return "{$st['visits']} visit" . ($st['visits'] === 1 ? '' : 's') . " from {$st['people']} " . ($st['people'] === 1 ? 'person' : 'people')
         . ", {$st['downloads']} download" . ($st['downloads'] === 1 ? '' : 's') . ", {$st['console']} console open" . ($st['console'] === 1 ? '' : 's');
}

function share_send_hit_mail(string $id, string $what, array $row): void {
    $s = share_load($id);
    if (!$s) return;
    $sum = share_summary($s);
    $label = ['first visit' => 'was opened for the first time', 'first download' => 'had its first download', 'download' => 'had a download'][$what];
    $lines = ["Your shared page \"{$s['title']}\" $label.", '',
        'When: ' . share_local_time($row['t']) . ' (Eastern)'];
    if (!empty($row['user'])) $lines[] = "Signed in as: {$row['user']}";
    if (!empty($row['file'])) $lines[] = "File: {$row['file']}";
    $lines[] = "Device: {$row['dev']} · {$row['br']}";
    $lines[] = "Page: {$sum['url']}";
    $lines[] = '';
    $lines[] = 'So far: ' . share_stats_line($sum) . '.';
    $lines[] = $sum['days_left'] >= 0 ? "Planned removal: in {$sum['days_left']} days." : 'Planned removal date has passed.';
    $lines[] = '';
    $lines[] = 'Details: ' . SITE_URL . '/#/admin (Shared tab)';
    send_mail(ADMIN_EMAIL, "Shared page: {$s['title']} $label", implode("\n", $lines) . "\n");
}

// Emails once when a share reaches its removal date. Runs from the hourly cron (report.php),
// from site visits and share visits, and when you open the admin Shared tab.
function maybe_share_reminders(): void {
    $lock = fopen(data_dir('shares') . '/reminders.lock', 'c');
    if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) return;
    foreach (glob(data_dir('shares') . '/*.json') as $f) {
        $id = basename($f, '.json');
        $s = share_load($id);
        if (!$s || empty($s['active']) || !empty($s['reminded']) || strtotime($s['expires']) > time()) continue;
        $sum = share_summary($s);
        $created = share_local_time($s['created']);
        $lastVisit = $sum['stats']['last_visit'] ? share_local_time($sum['stats']['last_visit']) : 'never';
        $text = implode("\n", [
            "Time to take down your shared page \"{$s['title']}\".", '',
            "Shared: $created",
            'Use: ' . share_stats_line($sum),
            "Last visit: $lastVisit",
            "Page: {$sum['url']}", '',
            'Take it down from the admin Shared tab (it answers "no longer available" right away),',
            'then delete the folder in File Manager when you are ready. Or extend it 30 days there.', '',
            SITE_URL . '/#/admin',
        ]) . "\n";
        // Marked as reminded even if mail fails, so a broken mailer can't cause repeat attempts;
        // the admin tab still shows the share as due.
        send_mail(ADMIN_EMAIL, "Reminder: take down shared page \"{$s['title']}\"", $text);
        share_update($id, function (array $x) { $x['reminded'] = now(); return $x; });
    }
    flock($lock, LOCK_UN);
    fclose($lock);
}

// Lines for the regular traffic report email.
function share_report_lines(): array {
    $lines = [];
    foreach (share_list() as $sum) {
        $state = empty($sum['active']) ? 'taken down' : ($sum['due'] ? 'due for removal' : "removal in {$sum['days_left']} days");
        $lines[] = "  {$sum['title']}: " . share_stats_line($sum) . " ($state)";
    }
    return $lines;
}
