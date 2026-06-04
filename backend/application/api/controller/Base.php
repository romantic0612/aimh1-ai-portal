<?php

namespace app\api\controller;

use think\Controller;
use think\Db;
use think\facade\Session;

class Base extends Controller
{
    protected function jsonOk(array $payload = [])
    {
        return json($payload, 200);
    }

    protected function jsonError($message, $status = 500, array $extra = [])
    {
        return json(array_merge([
            'success' => false,
            'message' => $message,
        ], $extra), $status);
    }

    protected function env($key, $default = '')
    {
        $value = getenv($key);
        return $value === false || $value === null ? $default : $value;
    }

    protected function splitCsv($value)
    {
        $items = array_map('trim', explode(',', (string) $value));
        return array_values(array_filter($items, function ($item) {
            return $item !== '';
        }));
    }

    protected function currentUser()
    {
        $user = Session::get('user');
        return is_array($user) ? $user : null;
    }

    protected function normalizedUser()
    {
        $user = $this->currentUser() ?: [];
        return [
            'user_id' => $this->firstNonEmpty($user, ['user_id', 'id', 'uid', 'UserId', 'UserCode']) ?: 'guest',
            'name' => $this->firstNonEmpty($user, ['name', 'Name', 'user_name', 'UserName']) ?: '访客',
            'college' => $this->firstNonEmpty($user, ['college', 'OrgName']) ?: '',
            'major' => $this->firstNonEmpty($user, ['major', 'Speciality']) ?: '',
            'groupName' => $this->firstNonEmpty($user, ['groupName', 'GroupName']) ?: '',
            'role' => $this->inferRole($user),
        ];
    }

    protected function requireLogin()
    {
        if ($this->currentUser()) {
            return null;
        }
        if (strtolower((string) $this->env('ALLOW_GUEST_CHAT', 'false')) === 'true') {
            Session::set('user', [
                'user_id' => 'guest',
                'name' => '访客',
            ]);
            return null;
        }
        return $this->jsonError('Not authenticated', 401);
    }

    protected function requireAdmin()
    {
        $loginError = $this->requireLogin();
        if ($loginError) {
            return $loginError;
        }
        $userId = strtolower((string) $this->normalizedUser()['user_id']);
        $admins = array_map('strtolower', $this->splitCsv($this->env('ADMIN_USER_IDS', '')));
        if (!$admins || !in_array($userId, $admins, true)) {
            return $this->jsonError('Admin access required', 403);
        }
        return null;
    }

    protected function dbConfigured()
    {
        return (bool) ($this->env('MYSQL_HOST') && $this->env('MYSQL_USER') && $this->env('MYSQL_DATABASE'));
    }

    protected function queryRows($sql, array $params = [], array $fallback = [])
    {
        if (!$this->dbConfigured()) {
            return $fallback;
        }
        try {
            return Db::query($sql, $params);
        } catch (\Throwable $error) {
            error_log('[mysql/query] ' . $error->getMessage());
            return $fallback;
        }
    }

    protected function executeSql($sql, array $params = [])
    {
        if (!$this->dbConfigured()) {
            return ['ok' => false, 'reason' => 'MySQL is not configured'];
        }
        try {
            return ['ok' => true, 'result' => Db::execute($sql, $params)];
        } catch (\Throwable $error) {
            error_log('[mysql/execute] ' . $error->getMessage());
            return ['ok' => false, 'reason' => $error->getMessage()];
        }
    }

    protected function firstNonEmpty(array $source, array $keys)
    {
        foreach ($keys as $key) {
            if (isset($source[$key]) && trim((string) $source[$key]) !== '') {
                return trim((string) $source[$key]);
            }
        }
        return '';
    }

    protected function inferRole(array $user)
    {
        $text = strtolower(implode(' ', array_map('strval', $user)));
        if (preg_match('/teacher|faculty|staff|教师|老师|教职工/u', $text)) {
            return 'teacher';
        }
        return 'student';
    }

    protected function requestJson()
    {
        $raw = file_get_contents('php://input');
        $data = json_decode($raw ?: '', true);
        return is_array($data) ? $data : input('post.');
    }
}
