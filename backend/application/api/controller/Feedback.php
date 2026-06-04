<?php

namespace app\api\controller;

class Feedback extends Base
{
    public function index()
    {
        $body = $this->requestJson();
        $topic = mb_substr(trim((string) ($body['topic'] ?? '')), 0, 64);
        $content = trim((string) ($body['content'] ?? ''));
        if ($topic === '' || $content === '') {
            return $this->jsonError('Missing topic or content', 400);
        }
        $user = $this->normalizedUser();
        $result = $this->executeSql(
            "INSERT INTO portal_feedback (user_id, user_name, topic, content, contact)
             VALUES (?, ?, ?, ?, ?)",
            [$user['user_id'], $user['name'], $topic, $content, null]
        );
        if (!$result['ok']) {
            return $this->jsonError($result['reason'], 503);
        }
        return json(['success' => true]);
    }
}
