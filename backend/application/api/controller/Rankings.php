<?php

namespace app\api\controller;

class Rankings extends Base
{
    public function index()
    {
        $type = input('get.type/s', 'student');
        $period = input('get.period/s', 'all');
        $metric = input('get.metric/s', 'questions');
        $type = in_array($type, ['student', 'teacher'], true) ? $type : 'student';
        $period = in_array($period, ['all', 'month', 'week', 'today'], true) ? $period : 'all';
        $metric = in_array($metric, ['questions', 'tokens', 'tools'], true) ? $metric : 'questions';

        $scoreColumn = $metric === 'tokens'
            ? 'COALESCE(SUM(total_token_count), 0)'
            : ($metric === 'tools' ? 'COALESCE(SUM(total_tool_call_count), 0)' : 'COUNT(r.run_id)');
        $dateWhere = '1=1';
        if ($period === 'today') {
            $dateWhere = 'DATE(r.started_at) = CURDATE()';
        } elseif ($period === 'week') {
            $dateWhere = 'r.started_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
        } elseif ($period === 'month') {
            $dateWhere = 'r.started_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
        }

        $rows = $this->queryRows(
            "SELECT r.user_id, COALESCE(MAX(r.user_name), r.user_id) AS user_name,
                    COALESCE(MAX(r.user_role), ?) AS user_role,
                    COALESCE(MAX(r.college), '') AS college,
                    COALESCE(MAX(r.major), '') AS major,
                    {$scoreColumn} AS score,
                    COALESCE(MAX(r.intent_label), '超级智能体') AS common_use
             FROM portal_agent_runs r
             LEFT JOIN portal_agent_daily_stats d ON d.user_id = r.user_id
             WHERE {$dateWhere} AND r.user_id <> 'guest'
             GROUP BY r.user_id
             HAVING user_role = ? AND score > 0
             ORDER BY score DESC
             LIMIT 50",
            [$type, $type],
            []
        );

        $items = [];
        foreach ($rows as $index => $row) {
            $items[] = [
                'id' => (string) ($row['user_id'] ?? ''),
                'rank' => $index + 1,
                'name' => $this->maskName($row['user_name'] ?? $row['user_id'] ?? ''),
                'college' => $row['college'] ?: '学院/部门',
                'major' => $row['major'] ?: ($type === 'teacher' ? '教师' : '专业'),
                'gender' => '',
                'userRole' => $row['user_role'] ?: $type,
                'count' => (int) ($row['score'] ?? 0),
                'commonUse' => $row['common_use'] ?: '超级智能体',
            ];
        }

        return json([
            'type' => $type,
            'period' => $period,
            'metric' => $metric,
            'items' => $items,
            'me' => ['rank' => 0, 'score' => 0],
        ]);
    }

    private function maskName($value)
    {
        $value = trim((string) $value);
        if ($value === '') {
            return '匿名用户';
        }
        if (mb_strlen($value) <= 1) {
            return $value;
        }
        return mb_substr($value, 0, 1) . str_repeat('*', max(1, mb_strlen($value) - 1));
    }
}
