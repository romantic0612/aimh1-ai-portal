<?php

namespace app\common\service;

class HttpClient
{
    public static function postForm($url, array $form, array $headers = [], $timeout = 30)
    {
        return self::request('POST', $url, http_build_query($form), array_merge([
            'Content-Type: application/x-www-form-urlencoded; charset=utf-8',
        ], $headers), $timeout);
    }

    public static function postJson($url, array $payload, array $headers = [], $timeout = 120, callable $write = null)
    {
        return self::request('POST', $url, json_encode($payload, JSON_UNESCAPED_UNICODE), array_merge([
            'Content-Type: application/json; charset=utf-8',
        ], $headers), $timeout, $write);
    }

    public static function get($url, array $headers = [], $timeout = 30)
    {
        return self::request('GET', $url, null, $headers, $timeout);
    }

    private static function request($method, $url, $body, array $headers, $timeout, callable $write = null)
    {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, $write ? false : true);
        curl_setopt($ch, CURLOPT_HEADER, false);
        curl_setopt($ch, CURLOPT_TIMEOUT, $timeout);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, min(15, $timeout));
        if ($headers) {
            curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        }
        if ($body !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
        }
        if ($write) {
            curl_setopt($ch, CURLOPT_WRITEFUNCTION, function ($ch, $chunk) use ($write) {
                $write($chunk);
                return strlen($chunk);
            });
        }
        $response = curl_exec($ch);
        $error = curl_error($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);
        if ($error) {
            throw new \RuntimeException($error);
        }
        return [
            'status' => $status,
            'body' => $response === false ? '' : (string) $response,
        ];
    }
}
