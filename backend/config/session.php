<?php

return [
    'id' => '',
    'var_session_id' => '',
    'prefix' => 'aimh1',
    'type' => '',
    'auto_start' => true,
    'expire' => 60 * 60 * 24 * 90,
    'name' => 'ahau.sid',
    'path' => '/',
    'domain' => '',
    'secure' => getenv('COOKIE_SECURE') === 'true',
    'httponly' => true,
    'use_cookies' => true,
    'cache_limiter' => 'nocache',
];
