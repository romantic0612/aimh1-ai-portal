<?php

namespace app\common\service;

class GeneralModelService
{
    public static function stream($message, array $user, callable $emit)
    {
        $baseUrl = rtrim((string) getenv('LLM_PLANNER_BASE_URL'), '/');
        $apiKey = (string) getenv('LLM_PLANNER_API_KEY');
        $model = getenv('LLM_PLANNER_MODEL') ?: 'MiniMax-M2.5';
        $agent = AgentCatalog::get('general');

        if (!$baseUrl || !$apiKey) {
            $answer = "默认通用模型尚未配置。TP5.1 后端已接管接口，请配置 LLM_PLANNER_BASE_URL、LLM_PLANNER_API_KEY 和 LLM_PLANNER_MODEL。";
            $emit(['type' => 'answer_chunk', 'content' => $answer, 'tool_name' => $agent['toolName']]);
            return ['answer' => $answer, 'conversation_id' => ''];
        }

        $payload = [
            'model' => $model,
            'stream' => true,
            'messages' => [
                ['role' => 'system', 'content' => '你是安徽农业大学 AI 门户的通用助手。'],
                ['role' => 'user', 'content' => $message],
            ],
        ];
        $answer = '';
        $buffer = '';
        HttpClient::postJson($baseUrl . '/chat/completions', $payload, [
            'Authorization: Bearer ' . $apiKey,
        ], (int) (getenv('LLM_READ_TIMEOUT_MS') ?: 120000), function ($chunk) use (&$buffer, &$answer, $emit, $agent) {
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
                $delta = $event['choices'][0]['delta']['content'] ?? '';
                if ($delta !== '') {
                    $answer .= $delta;
                    $emit(['type' => 'answer_chunk', 'content' => $delta, 'tool_name' => $agent['toolName']]);
                }
            }
        });

        return ['answer' => $answer, 'conversation_id' => ''];
    }
}
