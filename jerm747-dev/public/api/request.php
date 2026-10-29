<?php
// POST: a new project request from the contact form.
// Creates the project file, emails Jeremy, and emails the client their project key.
require __DIR__ . '/lib.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Use POST.', 405);
rate_limit('request', 5, 3600);

$in = body_json();
if (!empty($in['website'])) respond(['ok' => true, 'key' => 'J747-2222-2222']); // honeypot: pretend success for bots

$name = clean($in['name'] ?? '', 120);
$email = clean($in['email'] ?? '', 200);
$company = clean($in['company'] ?? '', 160);
$message = clean($in['message'] ?? '', 8000);

if ($name === '') fail('Add your name.');
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Add an email address I can reply to.');
if (mb_strlen($message) < 20) fail('Tell me a bit more about the project (at least a couple of sentences).');

$key = make_key();
$project = [
    'key' => $key,
    'created' => now(),
    'updated' => now(),
    'stage' => 'received',
    'title' => clean($in['title'] ?? '', 140) ?: ($company ?: $name) . ' project',
    'client' => ['name' => $name, 'email' => $email, 'company' => $company],
    'request' => [
        'type' => clean($in['type'] ?? '', 60),
        'budget' => clean($in['budget'] ?? '', 60),
        'timeline' => clean($in['timeline'] ?? '', 60),
        'estimate' => clean($in['estimate'] ?? '', 1000),
    ],
    'messages' => [[
        'id' => new_id(), 'from' => 'client', 'author' => $name,
        'body' => $message, 'at' => now(), 'files' => [],
    ]],
    'updates' => [[
        'id' => new_id(), 'title' => 'Request received',
        'body' => 'Your request is in. Jeremy reviews new requests within two business days.', 'at' => now(),
    ]],
    'items' => [],
    'files' => [],
    'notes' => '',
];
save_project($project);

$summary = "Project key: $key\nName: $name\nEmail: $email\nCompany: " . ($company ?: '-') .
    "\nType: {$project['request']['type']}\nBudget: {$project['request']['budget']}\nTimeline: {$project['request']['timeline']}" .
    "\nEstimate shown: " . ($project['request']['estimate'] ?: '-') . "\n\n$message\n";

send_mail(ADMIN_EMAIL, "New request $key from $name", $summary . "\nOpen admin: " . SITE_URL . "/#/admin\n", $email);
send_mail($email, "Your jerm747.dev project key: $key",
    "Hi $name,\n\nThanks for your request. Your project key is:\n\n    $key\n\n" .
    "Keep this key. It opens your project page, where you'll see messages, updates and files as the work moves along:\n" .
    portal_link($key) . "\n\nI review new requests within two business days.\n\nJeremy\njerm747.dev\n");

respond(['ok' => true, 'key' => $key]);
