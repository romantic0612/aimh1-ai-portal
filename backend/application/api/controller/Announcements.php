<?php

namespace app\api\controller;

class Announcements extends Base
{
    public function index()
    {
        $rows = $this->queryRows(
            "SELECT id, title, category, publish_time, created_at, is_top
             FROM announcements
             WHERE status = 'published'
             ORDER BY is_top DESC, COALESCE(publish_time, created_at) DESC, id DESC
             LIMIT 10"
        );
        $items = array_map(function ($row) {
            $date = $row['publish_time'] ?: ($row['created_at'] ?? '');
            return [
                'id' => $row['id'] ?? '',
                'title' => $row['title'] ?? '',
                'category' => $row['category'] ?: '公告',
                'date' => $date ? date('m-d', strtotime($date)) : '',
                'isTop' => !empty($row['is_top']),
            ];
        }, $rows);
        return json(['announcements' => $items]);
    }
}
