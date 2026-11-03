<?php
declare(strict_types=1);
require dirname(__DIR__, 3) . '/site-admin/core.php';
sa_init(require __DIR__ . '/instance.php');
sa_dispatch();
