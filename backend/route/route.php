<?php

use think\facade\Route;

Route::get('api/health', 'api/Health/index');
Route::get('api/auth/session', 'api/Auth/session');
Route::get('api/auth/login', 'api/Auth/login');
Route::post('api/auth/logout', 'api/Auth/logout');
Route::post('api/auth/exchange', 'api/Auth/exchange');
Route::get('callback', 'api/Auth/callback');

Route::get('api/announcements', 'api/Announcements/index');
Route::get('api/chat/history', 'api/Chat/history');
Route::get('api/chat/history/detail', 'api/Chat/historyDetail');
Route::delete('api/chat/history/:sessionId', 'api/Chat/deleteHistory');
Route::delete('api/chat/history', 'api/Chat/clearHistory');
Route::post('api/chat/stream', 'api/Chat/stream');
Route::get('api/rankings', 'api/Rankings/index');
Route::get('api/agents', 'api/Agents/index');
Route::post('api/feedback', 'api/Feedback/index');
Route::post('api/join', 'api/Join/index');

Route::get('api/admin/session', 'api/Admin/session');
Route::get('api/admin/overview', 'api/Admin/overview');
Route::get('api/admin/visits', 'api/Admin/visits');
Route::get('api/admin/questions', 'api/Admin/questions');
Route::get('api/admin/question-top', 'api/Admin/questionTop');
Route::get('api/admin/session-detail', 'api/Admin/sessionDetail');
