<?php

namespace app\common\service;

class DifyService
{
    public static function configForAgent($agentId)
    {
        $upper = strtoupper($agentId);
        $base = rtrim((string) getenv("DIFY_{$upper}_BASE_URL"), '/');
        $chatUrl = rtrim((string) getenv("DIFY_{$upper}_CHAT_URL"), '/');
        $apiKey = (string) getenv("DIFY_{$upper}_API_KEY");

        if ($agentId === 'xg') {
            $base = $base ?: rtrim((string) getenv('DIFY_NONGXIAOXIN_BASE_URL'), '/');
            $chatUrl = $chatUrl ?: rtrim((string) getenv('DIFY_NONGXIAOXIN_CHAT_URL'), '/');
            $apiKey = $apiKey ?: (string) getenv('DIFY_NONGXIAOXIN_API_KEY');
        }

        if (!$chatUrl && $base) {
            $chatUrl = $base . '/v1/chat-messages';
        }

        return [
            'chatUrl' => $chatUrl,
            'apiKey' => $apiKey,
        ];
    }

    public static function stream($agentId, $message, $sessionId, array $user, array $files, array $inputs, callable $emit)
    {
        $cfg = self::configForAgent($agentId);
        $agent = AgentCatalog::get($agentId);
        if (!$cfg['chatUrl'] || !$cfg['apiKey']) {
            $answer = sprintf(
                "%s 已选中，但 Dify 地址或密钥尚未配置。TP5.1 后端已接管路由，配置 DIFY_%s_* 后会转为真实流式回答。",
                $agent['name'],
                strtoupper($agentId)
            );
            $emit(['type' => 'answer_chunk', 'content' => $answer, 'tool_name' => $agent['toolName']]);
            return ['answer' => $answer, 'conversation_id' => ''];
        }

        $answer = '';
        $conversationId = '';
        $buffer = '';
        $payload = [
            'inputs' => (object) $inputs,
            'query' => $message,
            'response_mode' => 'streaming',
            'conversation_id' => '',
            'user' => (string) ($user['user_id'] ?? 'guest'),
            'files' => $files,
        ];

        HttpClient::postJson($cfg['chatUrl'], $payload, [
            'Authorization: Bearer ' . $cfg['apiKey'],
        ], (int) (getenv('DIFY_READ_TIMEOUT') ?: 600), function ($chunk) use (&$buffer, &$answer, &$conversationId, $emit, $agent) {
            $buffer .= $chunk;
            while (($pos = strpos($buffer, "\n")) !== false) {
                $line = trim(substr($buffer, 0, $pos));
                $buffer = substr($buffer, $pos + 1);
                if (strpos($line, 'data:') !== 0) {
                    continue;
                }
                $json = trim(substr($line, 5));
                if ($json === '' || $json === '[DONE]') {
                    continue;
                }
                $event = json_decode($json, true);
                if (!is_array($event)) {
                    continue;
                }
                if (!empty($event['conversation_id'])) {
                    $conversationId = (string) $event['conversation_id'];
                }
                $content = '';
                foreach (['answer', 'text', 'content'] as $key) {
                    if (isset($event[$key]) && is_string($event[$key])) {
                        $content = $event[$key];
                        break;
                    }
                }
                if ($content !== '') {
                    $answer .= $content;
                    $emit(['type' => 'answer_chunk', 'content' => $content, 'tool_name' => $agent['toolName']]);
                }
            }
        });

        return ['answer' => $answer, 'conversation_id' => $conversationId];
    }
}
