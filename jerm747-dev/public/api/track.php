<?php
// POST {type: "view"|"launch", path, ref, project} from the site.
require __DIR__ . '/lib.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Use POST.', 405);
rate_limit('track', 240, 3600);
$in = body_json();
$type = in_array($in['type'] ?? '', ['view', 'launch'], true) ? $in['type'] : 'view';
$path = clean((string)($in['path'] ?? '/'), 120) ?: '/';
// Group project pages so private keys never land in the stats.
if (str_starts_with($path, '/#/project')) $path = '/#/project';
if (str_starts_with($path, '/#/admin')) respond(['ok' => true]);
record_event($type, $path, clean((string)($in['ref'] ?? ''), 300), clean((string)($in['project'] ?? ''), 80));
maybe_send_report();
respond(['ok' => true]);
