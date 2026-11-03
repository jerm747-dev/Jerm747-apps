<?php
declare(strict_types=1);
// Site-specific adapter. Credentials and runtime data never belong in this file.
$public = dirname(__DIR__, 3);
return [
    'id' => 'returnity', 'name' => 'Returnity', 'artist' => 'Nige Hood',
    'url' => 'https://jerm747.dev/sites/nige-hood',
    'basePath' => '/sites/nige-hood/', 'siteDir' => dirname(__DIR__),
    'dataDir' => $public . '/api/data/site-admin/returnity',
    'ownerUsername' => 'jeremy', 'ownerName' => 'Jeremy',
    'ownerHashFile' => $public . '/api/data/admin.json',
    'mailFrom' => 'admin@jerm747.dev', 'mailMode' => 'mail',
    'cronFile' => __DIR__ . '/cron.php',
];
