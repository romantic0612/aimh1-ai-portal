<?php

namespace app\api\controller;

class Admin extends Base
{
    public function session()
    {
        if ($error = $this->requireAdmin()) {
            return $error;
        }
        return json([
            'success' => true,
            'user' => $this->normalizedUser(),
            'adminUserIdsConfigured' => count($this->splitCsv($this->env('ADMIN_USER_IDS', ''))) > 0,
        ]);
    }

    public function overview()
    {
        if ($error = $this->requireAdmin()) {
            return $error;
        }
        $stats = $this->queryRows(
            "SELECT COUNT(*) AS questions,
                    SUM(status = 'success') AS successRuns,
                    SUM(status <> 'success') AS errorRuns,
                    COALESCE(AVG(latency_ms), 0) AS avgLatencyMs
             FROM portal_agent_runs
             WHERE started_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)",
            [],
            [['questions' => 0, 'successRuns' => 0, 'errorRuns' => 0, 'avgLatencyMs' => 0]]
        );
        return json([
            'success' => true,
            'range' => input('get.range/s', '7d'),
            'stats' => [
                'visits' => 0,
                'activeUsers' => 0,
                'questions' => (int) ($stats[0]['questions'] ?? 0),
                'successRuns' => (int) ($stats[0]['successRuns'] ?? 0),
                'errorRuns' => (int) ($stats[0]['errorRuns'] ?? 0),
                'effectiveRuns' => 0,
                'totalTokens' => 0,
                'promptTokens' => 0,
                'completionTokens' => 0,
                'toolCalls' => 0,
                'avgLatencyMs' => (int) round((float) ($stats[0]['avgLatencyMs'] ?? 0)),
            ],
            'topAgents' => [],
        ]);
    }

    public function visits()
    {
        if ($error = $this->requireAdmin()) {
            return $error;
        }
        return json(['success' => true, 'range' => input('get.range/s', '7d'), 'visits' => []]);
    }

    public function questions()
    {
        if ($error = $this->requireAdmin()) {
            return $error;
        }
        $rows = $this->queryRows(
            "SELECT run_id AS runId, session_id AS sessionId, user_id AS userId, user_name AS userName,
                    user_role AS userRole, college, question, final_answer AS finalAnswer, status,
                    intent_label AS intentLabel, planner_type AS plannerType, latency_ms AS latencyMs,
                    error_message AS errorMessage, started_at AS startedAt, finished_at AS finishedAt
             FROM portal_agent_runs
             ORDER BY started_at DESC
             LIMIT 100",
            [],
            []
        );
        return json(['success' => true, 'range' => input('get.range/s', '7d'), 'questions' => $rows]);
    }

    public function questionTop()
    {
        if ($error = $this->requireAdmin()) {
            return $error;
        }
        $rows = $this->queryRows(
            "SELECT question, COUNT(*) AS count, MAX(started_at) AS lastAskedAt
             FROM portal_agent_runs
             WHERE question IS NOT NULL AND question <> ''
             GROUP BY question
             ORDER BY count DESC, lastAskedAt DESC
             LIMIT 50",
            [],
            []
        );
        return json(['success' => true, 'range' => input('get.range/s', '7d'), 'items' => $rows]);
    }

    public function sessionDetail()
    {
        if ($error = $this->requireAdmin()) {
            return $error;
        }
        $sessionId = substr(trim((string) input('get.sessionId/s', input('get.session_id/s', ''))), 0, 96);
        if (!$sessionId) {
            return $this->jsonError('Missing sessionId', 400);
        }
        return json([
            'success' => true,
            'session' => $this->queryRows("SELECT * FROM portal_agent_sessions WHERE session_id = ? LIMIT 1", [$sessionId], [])[0] ?? null,
            'messages' => $this->queryRows("SELECT * FROM portal_agent_messages WHERE session_id = ? ORDER BY created_at ASC LIMIT 300", [$sessionId], []),
            'runs' => $this->queryRows("SELECT * FROM portal_agent_runs WHERE session_id = ? ORDER BY started_at DESC LIMIT 100", [$sessionId], []),
            'toolCalls' => $this->queryRows("SELECT * FROM portal_agent_tool_calls WHERE session_id = ? ORDER BY started_at DESC LIMIT 100", [$sessionId], []),
            'steps' => $this->queryRows("SELECT * FROM portal_agent_run_steps WHERE session_id = ? ORDER BY step_index ASC LIMIT 200", [$sessionId], []),
        ]);
    }
}
