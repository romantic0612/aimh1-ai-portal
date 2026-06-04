<?php

namespace app\api\controller;

use app\common\service\HttpClient;
use think\facade\Session;

class Auth extends Base
{
    public function session()
    {
        $user = $this->currentUser();
        return json([
            'authenticated' => (bool) $user,
            'user' => $user,
        ]);
    }

    public function login()
    {
        $authServer = rtrim($this->env('OAUTH_AUTH_SERVER'), '/');
        $clientId = $this->env('OAUTH_CLIENT_ID');
        $redirectUri = $this->env('OAUTH_REDIRECT_URI');
        if (!$authServer || !$clientId || !$redirectUri) {
            return $this->jsonError('OAuth is not configured', 503);
        }

        $state = bin2hex(random_bytes(16));
        Session::set('oauthState', $state);
        $query = http_build_query([
            'response_type' => 'code',
            'client_id' => $clientId,
            'redirect_uri' => $redirectUri,
            'scope' => $this->env('OAUTH_SCOPE', 'cas_get_userInfo'),
            'state' => $state,
        ]);
        return redirect($authServer . '/authorize?' . $query);
    }

    public function logout()
    {
        Session::clear();
        cookie('ahau.sid', null);
        return json(['success' => true]);
    }

    public function exchange()
    {
        try {
            return json($this->completeExchange($this->requestJson()));
        } catch (\Throwable $error) {
            return $this->jsonError($error->getMessage(), 502);
        }
    }

    public function callback()
    {
        $code = input('get.code/s', '');
        if (!$code) {
            return redirect('/');
        }
        try {
            $this->completeExchange([
                'code' => $code,
                'state' => input('get.state/s', ''),
            ]);
            return redirect('/');
        } catch (\Throwable $error) {
            return $this->jsonError('OAuth callback error: ' . $error->getMessage(), 502);
        }
    }

    private function completeExchange(array $payload)
    {
        $code = trim((string) ($payload['code'] ?? ''));
        if ($code === '') {
            throw new \RuntimeException('Missing required field: code');
        }
        $expectedState = Session::get('oauthState');
        $state = trim((string) ($payload['state'] ?? ''));
        if ($expectedState && $state && $expectedState !== $state) {
            throw new \RuntimeException('Invalid oauth state');
        }

        $authServer = rtrim($this->env('OAUTH_AUTH_SERVER'), '/');
        $tokenResp = HttpClient::postForm($authServer . '/accessToken', [
            'grant_type' => 'authorization_code',
            'code' => $code,
            'client_id' => $this->env('OAUTH_CLIENT_ID'),
            'client_secret' => $this->env('OAUTH_CLIENT_SECRET'),
            'redirect_uri' => $this->env('OAUTH_REDIRECT_URI'),
        ]);
        if ($tokenResp['status'] < 200 || $tokenResp['status'] >= 300) {
            throw new \RuntimeException('Token exchange failed');
        }
        $token = $this->parsePayload($tokenResp['body']);
        $accessToken = $token['access_token'] ?? $token['accessToken'] ?? '';
        if (!$accessToken) {
            throw new \RuntimeException('Token response missing access_token');
        }

        $userinfoEndpoint = $this->env('OAUTH_USERINFO_ENDPOINT', $authServer . '/profile');
        $userResp = HttpClient::postForm($userinfoEndpoint, ['access_token' => $accessToken]);
        if ($userResp['status'] < 200 || $userResp['status'] >= 300) {
            $separator = strpos($userinfoEndpoint, '?') === false ? '?' : '&';
            $userResp = HttpClient::get($userinfoEndpoint . $separator . http_build_query(['access_token' => $accessToken]));
        }
        if ($userResp['status'] < 200 || $userResp['status'] >= 300) {
            throw new \RuntimeException('User info request failed');
        }

        $rawUser = $this->parsePayload($userResp['body']);
        $user = $this->normalizeCasUser($rawUser);
        Session::set('user', array_merge($rawUser, $user));
        Session::set('accessToken', $accessToken);
        Session::delete('oauthState');

        return [
            'accessToken' => $accessToken,
            'user' => array_merge($rawUser, $user),
        ];
    }

    private function parsePayload($text)
    {
        $json = json_decode((string) $text, true);
        if (is_array($json)) {
            return $json;
        }
        parse_str((string) $text, $parsed);
        return is_array($parsed) ? $parsed : [];
    }

    private function normalizeCasUser(array $raw)
    {
        $userId = $this->firstNonEmpty($raw, ['user_id', 'id', 'uid', 'UserId', 'UserCode', 'account']);
        $name = $this->firstNonEmpty($raw, ['name', 'Name', 'user_name', 'UserName', 'realName']);
        return [
            'user_id' => $userId ?: 'guest',
            'name' => $name ?: $userId ?: '访客',
            'college' => $this->firstNonEmpty($raw, ['college', 'OrgName', 'department']),
            'major' => $this->firstNonEmpty($raw, ['major', 'Speciality']),
            'groupName' => $this->firstNonEmpty($raw, ['groupName', 'GroupName']),
            'role' => $this->inferRole($raw),
        ];
    }
}
