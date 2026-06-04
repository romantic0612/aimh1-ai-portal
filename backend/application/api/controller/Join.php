<?php

namespace app\api\controller;

class Join extends Base
{
    public function index()
    {
        $body = $this->requestJson();
        $user = $this->normalizedUser();
        $name = mb_substr(trim((string) ($body['name'] ?? '')), 0, 128);
        $role = mb_substr(trim((string) ($body['role'] ?? '')), 0, 128);
        $reason = trim((string) ($body['reason'] ?? ''));
        $result = $this->executeSql(
            "INSERT INTO portal_join_requests (user_id, user_name, name, role_title, reason)
             VALUES (?, ?, ?, ?, ?)",
            [
                $user['user_id'],
                $user['name'],
                $name ?: $user['name'],
                $role ?: '未选择方向',
                $reason ?: null,
            ]
        );
        if (!$result['ok']) {
            return $this->jsonError($result['reason'], 503);
        }
        return json(['success' => true]);
    }
}
