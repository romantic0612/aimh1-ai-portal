<?php

return [
    'app_namespace' => 'app',
    'app_debug' => getenv('APP_DEBUG') === 'true',
    'app_trace' => false,
    'default_timezone' => 'Asia/Shanghai',
    'default_return_type' => 'json',
    'url_route_on' => true,
    'url_route_must' => false,
    'var_pathinfo' => 's',
    'pathinfo_depr' => '/',
    'controller_suffix' => false,
    'default_module' => 'api',
    'deny_module_list' => ['common'],
];
