<?php
// Traffic report email. Two ways to run it:
//   cPanel cron (recommended):  php /home/YOUR_USER/public_html/jerm747.games/api/report.php
//   URL (for cron services):    https://jerm747.games/api/report.php?token=YOUR_TOKEN
// Your token and exact command are shown on the admin Traffic tab.
// It only sends when a report is due (every 12 or 24 hours, set in admin).
require __DIR__ . '/lib.php';

if (PHP_SAPI !== 'cli') {
    $s = settings();
    if (!hash_equals($s['report_token'], (string)($_GET['token'] ?? ''))) fail('Not allowed.', 403);
}
$sent = maybe_send_report();
if (PHP_SAPI === 'cli') { echo $sent ? "Report sent\n" : "No report due\n"; exit; }
respond(['ok' => true, 'sent' => $sent]);
