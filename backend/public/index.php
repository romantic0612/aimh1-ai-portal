<?php

// [ Application entry ]
define('APP_PATH', __DIR__ . '/../application/');
define('APP_DEBUG', getenv('APP_DEBUG') === 'true');

$autoload = __DIR__ . '/../vendor/autoload.php';
$base = __DIR__ . '/../thinkphp/base.php';

if (is_file($autoload)) {
    require $autoload;
}

if (is_file($base)) {
    require $base;
} elseif (class_exists('\\think\\App')) {
    $app = new \think\App();
    $app->run()->send();
    exit;
} else {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'success' => false,
        'message' => 'ThinkPHP runtime is not installed. Run composer install in backend/.',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

\think\Container::get('app')->run()->send();
