<?php

namespace app\api\controller;

use app\common\service\AgentCatalog;
use app\common\service\DifyService;
use app\common\service\GeneralModelService;
use app\common\service\Sse;
use think\Db;

class Chat extends Base
{
    public function history()
    {
        if ($error = $this->requireLogin()) {
            return $error;
        }
        $user = $this->normalizedUser();
        $rows = $this->queryRows(
            "SELECT session_id AS sessionId,
                    COALESCE(NULLIF(title, ''), '新对话') AS sessionTitle,
                    created_at AS createTime,
                    updated_at AS updateTime,
                    last_message_at AS lastMessageAt,
                    DATE_FORMAT(COALESCE(last_message_at, updated_at, created_at), '%Y-%m-%d %H:%i:%s') AS displayTime
             FROM portal_agent_sessions
             WHERE user_id = ?
             ORDER BY COALESCE(last_message_at, updated_at, created_at) DESC
             LIMIT 30",
            [$user['user_id']],
            []
        );
        return json(['success' => true, 'data' => ['sessionList' => $rows]]);
    }

    public function historyDetail()
    {
        if ($error = $this->requireLogin()) {
            return $error;
        }
        $user = $this->normalizedUser();
        $sessionId = substr(trim((string) input('get.sessionId/s', input('get.session_id/s', ''))), 0, 96);
        if (!$sessionId) {
            return $this->jsonError('Missing sessionId', 400);
        }
        $sessions = $this->queryRows(
            "SELECT session_id AS sessionId, COALESCE(NULLIF(title, ''), '历史会话') AS sessionTitle
             FROM portal_agent_sessions
             WHERE session_id = ? AND user_id = ?
             LIMIT 1",
            [$sessionId, $user['user_id']]
        );
        if (!$sessions) {
            return $this->jsonError('History session not found', 404);
        }
        $messages = $this->queryRows(
            "SELECT role, content, created_at AS createTime,
                    DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS displayTime
             FROM portal_agent_messages
             WHERE session_id = ? AND role IN ('user', 'assistant')
             ORDER BY created_at ASC, id ASC
             LIMIT 200",
            [$sessionId],
            []
        );
        return json([
            'success' => true,
            'data' => [
                'sessionId' => $sessionId,
                'sessionTitle' => $sessions[0]['sessionTitle'],
                'chatList' => array_map(function ($row) {
                    return [
                        'type' => $row['role'] ?? '',
                        'content' => $row['content'] ?? '',
                        'createTime' => $row['createTime'] ?? '',
                        'displayTime' => $row['displayTime'] ?? '',
                    ];
                }, $messages),
            ],
        ]);
    }

    public function deleteHistory($sessionId)
    {
        if ($error = $this->requireLogin()) {
            return $error;
        }
        if (!$this->dbConfigured()) {
            return $this->jsonError('MySQL is not configured', 503);
        }
        $user = $this->normalizedUser();
        $sessionId = substr(trim((string) $sessionId), 0, 96);
        try {
            Db::startTrans();
            $found = Db::query(
                "SELECT session_id FROM portal_agent_sessions WHERE session_id = ? AND user_id = ? LIMIT 1",
                [$sessionId, $user['user_id']]
            );
            if (!$found) {
                Db::rollback();
                return $this->jsonError('History session not found', 404);
            }
            foreach (['portal_agent_run_steps', 'portal_agent_tool_calls', 'portal_agent_messages', 'portal_agent_runs'] as $table) {
                Db::execute("DELETE FROM {$table} WHERE session_id = ?", [$sessionId]);
            }
            Db::execute("DELETE FROM portal_agent_sessions WHERE session_id = ? AND user_id = ?", [$sessionId, $user['user_id']]);
            Db::commit();
            return json(['success' => true]);
        } catch (\Throwable $error) {
            Db::rollback();
            return $this->jsonError('Failed to delete chat history', 500);
        }
    }

    public function clearHistory()
    {
        if ($error = $this->requireLogin()) {
            return $error;
        }
        if (!$this->dbConfigured()) {
            return $this->jsonError('MySQL is not configured', 503);
        }
        $user = $this->normalizedUser();
        try {
            Db::startTrans();
            foreach (['portal_agent_run_steps', 'portal_agent_tool_calls', 'portal_agent_messages', 'portal_agent_runs'] as $table) {
                Db::execute(
                    "DELETE FROM {$table} WHERE session_id IN (SELECT session_id FROM portal_agent_sessions WHERE user_id = ?)",
                    [$user['user_id']]
                );
            }
            Db::execute("DELETE FROM portal_agent_sessions WHERE user_id = ?", [$user['user_id']]);
            Db::commit();
            return json(['success' => true]);
        } catch (\Throwable $error) {
            Db::rollback();
            return $this->jsonError('Failed to clear chat history', 500);
        }
    }

    public function stream()
    {
        if ($error = $this->requireLogin()) {
            return $error;
        }
        $body = $this->requestJson();
        $message = trim((string) ($body['message'] ?? ''));
        if ($message === '') {
            return $this->jsonError('Missing required field: message', 400);
        }

        $user = $this->normalizedUser();
        $sessionId = substr(trim((string) ($body['session_id'] ?? $body['portal_session_id'] ?? '')), 0, 96);
        if ($sessionId === '') {
            $sessionId = 'sess_' . bin2hex(random_bytes(12));
        }
        $runId = 'run_' . bin2hex(random_bytes(12));
        $agentId = AgentCatalog::normalize($body['agent_id'] ?? $body['agentId'] ?? $body['selected_agent_id'] ?? '', 'general');
        if (!in_array($agentId, AgentCatalog::businessIds(), true)) {
            $agentId = 'general';
        }
        $agent = AgentCatalog::get($agentId);
        $files = isset($body['files']) && is_array($body['files']) ? $body['files'] : [];
        $inputs = isset($body['inputs']) && is_array($body['inputs']) ? $body['inputs'] : [];

        Sse::start();
        Sse::send([
            'type' => 'thought',
            'content' => '正在理解你的问题，并选择合适的能力。',
            'conversation_id' => $sessionId,
            'run_id' => $runId,
        ]);
        Sse::send([
            'type' => 'planner',
            'content' => $agentId === 'general' ? '未选择校园智能体，使用默认通用模型。' : '已选择 ' . $agent['name'] . ' 能力。',
            'tool_name' => $agent['toolName'],
            'data' => [
                'strategy' => 'single_agent',
                'agentId' => $agentId,
                'selected_agents' => [$agentId],
                'planner' => $agentId === 'general' ? 'default' : 'manual',
            ],
        ]);

        try {
            $result = $agentId === 'general'
                ? GeneralModelService::stream($message, $user, function ($payload) {
                    Sse::send($payload);
                })
                : DifyService::stream($agentId, $message, $sessionId, $user, $files, $inputs, function ($payload) {
                    Sse::send($payload);
                });
            $this->recordMinimalRun($sessionId, $runId, $user, $message, $agent, $result['answer'] ?? '');
            Sse::send([
                'type' => 'final',
                'content' => '已返回最终回答。',
                'answer' => $result['answer'] ?? '',
                'conversation_id' => $sessionId,
                'portal_session_id' => $sessionId,
                'run_id' => $runId,
                'dify_conversation_id' => $result['conversation_id'] ?? '',
                'route' => [
                    'strategy' => 'single_agent',
                    'agentId' => $agentId,
                    'agent' => $agent,
                ],
                'tool_events' => [],
            ]);
        } catch (\Throwable $error) {
            Sse::send([
                'type' => 'error',
                'content' => '后端流式调用失败：' . $error->getMessage(),
                'portal_session_id' => $sessionId,
                'run_id' => $runId,
            ]);
        }
        exit;
    }

    private function recordMinimalRun($sessionId, $runId, array $user, $question, array $agent, $answer)
    {
        if (!$this->dbConfigured()) {
            return;
        }
        try {
            Db::execute(
                "INSERT INTO portal_agent_sessions
                 (session_id, user_id, user_name, user_role, college, major, title, first_message_at, last_message_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
                 ON DUPLICATE KEY UPDATE last_message_at = NOW(), updated_at = NOW()",
                [$sessionId, $user['user_id'], $user['name'], $user['role'], $user['college'], $user['major'], mb_substr($question, 0, 80)]
            );
            Db::execute(
                "INSERT INTO portal_agent_runs
                 (run_id, session_id, user_id, user_name, user_role, college, major, question, final_answer, status, intent_label, started_at, finished_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'success', ?, NOW(), NOW())",
                [$runId, $sessionId, $user['user_id'], $user['name'], $user['role'], $user['college'], $user['major'], $question, $answer, $agent['toolName']]
            );
            Db::execute(
                "INSERT INTO portal_agent_messages (message_id, session_id, run_id, user_id, role, content, content_type)
                 VALUES (?, ?, ?, ?, 'user', ?, 'text'), (?, ?, ?, ?, 'assistant', ?, 'text')",
                [
                    'msg_' . bin2hex(random_bytes(8)), $sessionId, $runId, $user['user_id'], $question,
                    'msg_' . bin2hex(random_bytes(8)), $sessionId, $runId, $user['user_id'], $answer,
                ]
            );
        } catch (\Throwable $error) {
            error_log('[chat/record] ' . $error->getMessage());
        }
    }
}
