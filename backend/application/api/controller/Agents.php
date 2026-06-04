<?php

namespace app\api\controller;

use app\common\service\AgentCatalog;

class Agents extends Base
{
    public function index()
    {
        $rows = $this->queryRows(
            "SELECT agent_id, name, status, detail, target_url
             FROM portal_agent_links
             WHERE is_active = 1
             ORDER BY sort_order ASC, id ASC",
            [],
            []
        );
        if (!$rows) {
            $rows = array_values(array_filter(AgentCatalog::all(), function ($agent) {
                return $agent['id'] !== 'general';
            }));
            return json([
                'agents' => array_map(function ($agent) {
                    return [
                        'id' => $agent['id'],
                        'name' => $agent['name'],
                        'status' => $agent['status'],
                        'detail' => $agent['summary'] ?? '',
                        'targetUrl' => '/chat?agent_id=' . $agent['id'],
                    ];
                }, $rows),
            ]);
        }

        return json([
            'agents' => array_map(function ($row) {
                return [
                    'id' => $row['agent_id'] ?? '',
                    'name' => $row['name'] ?? '',
                    'status' => $row['status'] ?: '外部系统',
                    'detail' => $row['detail'] ?? '',
                    'targetUrl' => $row['target_url'] ?? '',
                ];
            }, $rows),
        ]);
    }
}
