<?php

return [
    'type' => 'mysql',
    'hostname' => getenv('MYSQL_HOST') ?: '127.0.0.1',
    'database' => getenv('MYSQL_DATABASE') ?: '',
    'username' => getenv('MYSQL_USER') ?: '',
    'password' => getenv('MYSQL_PASSWORD') ?: '',
    'hostport' => getenv('MYSQL_PORT') ?: '3306',
    'charset' => 'utf8mb4',
    'prefix' => '',
    'debug' => getenv('APP_DEBUG') === 'true',
    'deploy' => 0,
    'rw_separate' => false,
    'break_reconnect' => true,
    'fields_strict' => false,
    'resultset_type' => 'array',
    'datetime_format' => 'Y-m-d H:i:s',
];
