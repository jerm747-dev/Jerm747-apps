<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require dirname(__DIR__, 3) . '/site-admin/core.php';
sa_init(require __DIR__ . '/instance.php');
try {
    sa_update('scheduler', fn($previous) => ['lastRun' => time()]);
    echo json_encode(sa_run_mail(), JSON_THROW_ON_ERROR) . PHP_EOL;
}
catch (Throwable $e) { fwrite(STDERR, $e->getMessage() . PHP_EOL); exit(1); }
