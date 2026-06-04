<?php

namespace app\common\service;

class AgentCatalog
{
    public static function all()
    {
        return [
            'general' => [
                'id' => 'general',
                'name' => '农芯智 AI',
                'provider' => 'openai-compatible',
                'toolName' => 'minimax_general_chat',
                'entryType' => 'chat',
                'status' => 'online',
            ],
            'jiaowu' => [
                'id' => 'jiaowu',
                'name' => 'Jiaowu Agent',
                'provider' => 'dify',
                'toolName' => 'dify_jiaowu_agent',
                'entryType' => 'chat',
                'status' => 'online',
                'summary' => 'Course schedule, grades, exams, and training-plan questions.',
            ],
            'library' => [
                'id' => 'library',
                'name' => 'AI Librarian',
                'provider' => 'dify',
                'toolName' => 'dify_library_agent',
                'entryType' => 'chat',
                'status' => 'online',
                'summary' => 'Borrowing, returning, renewing, databases, papers, and library services.',
            ],
            'xg' => [
                'id' => 'xg',
                'name' => 'AI Counselor',
                'provider' => 'dify',
                'toolName' => 'dify_xg_agent',
                'entryType' => 'chat',
                'status' => 'online',
                'summary' => 'Student affairs, counselor, scholarship, dormitory, and campus-life questions.',
            ],
        ];
    }

    public static function get($id)
    {
        $agents = self::all();
        return isset($agents[$id]) ? $agents[$id] : $agents['general'];
    }

    public static function normalize($id, $fallback = 'general')
    {
        $id = trim((string) $id);
        $agents = self::all();
        return isset($agents[$id]) ? $id : $fallback;
    }

    public static function businessIds()
    {
        return ['jiaowu', 'library', 'xg'];
    }
}
