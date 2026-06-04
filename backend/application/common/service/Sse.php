<?php

namespace app\common\service;

class Sse
{
    public static function start()
    {
        @ini_set('output_buffering', 'off');
        @ini_set('zlib.output_compression', '0');
        while (ob_get_level() > 0) {
            @ob_end_flush();
        }
        header('Content-Type: text/event-stream; charset=utf-8');
        header('Cache-Control: no-cache, no-transform');
        header('Connection: keep-alive');
        header('X-Accel-Buffering: no');
        flush();
    }

    public static function send(array $payload)
    {
        echo 'data: ' . json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n\n";
        flush();
    }

    public static function comment($text)
    {
        echo ': ' . str_replace(["\r", "\n"], ' ', (string) $text) . "\n\n";
        flush();
    }
}
