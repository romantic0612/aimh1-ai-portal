const JSON_HEADERS = { "Content-Type": "application/json" };

export const CAMPUS_AGENTS = [
  { id: "jiaowu", name: "教务智能体", shortName: "教务", summary: "课程、成绩、考试、培养方案等教务问题。" },
  { id: "library", name: "AI馆员", shortName: "馆员", summary: "借阅、续借、数据库、馆藏与座位预约。" },
  { id: "xg", name: "AI辅导员", shortName: "辅导员", summary: "学工、奖助贷、宿舍、心理与校园生活。" },
  { id: "data", name: "AI问数", shortName: "问数", summary: "校内指标、统计口径、数据查询与分析。" },
  { id: "service", name: "AI办事", shortName: "办事", summary: "办事事项、材料清单、流程和办理入口。" }
];

export async function requestJson(path, options = {}) {
  const response = await fetch(path, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.body ? JSON_HEADERS : {}),
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    const error = new Error(data.message || `请求失败：${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export function getSession(path = "/") {
  return requestJson(`/api/auth/session?path=${encodeURIComponent(path)}`);
}

export function getAnnouncements() {
  return requestJson("/api/announcements").catch(() => ({ announcements: [] }));
}

export function getAgents() {
  return requestJson("/api/agents").catch(() => ({ agents: [] }));
}

export function getRankings({ type = "student", period = "all", metric = "effective_runs" } = {}) {
  const params = new URLSearchParams({ type, period, metric });
  return requestJson(`/api/rankings?${params.toString()}`);
}

export function getChatHistory() {
  return requestJson("/api/chat/history");
}

export function getChatHistoryDetail(sessionId) {
  return requestJson(`/api/chat/history/detail?sessionId=${encodeURIComponent(sessionId)}`);
}

export function deleteChatHistory(sessionId) {
  return requestJson(`/api/chat/history/${encodeURIComponent(sessionId)}`, { method: "DELETE" });
}

export function clearChatHistory() {
  return requestJson("/api/chat/history", { method: "DELETE" });
}

export function submitFeedback(payload) {
  return requestJson("/api/feedback", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function submitJoin(payload) {
  return requestJson("/api/join", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function streamChat({ message, sessionId, agentId, inputs, onEvent }) {
  const response = await fetch("/api/chat/stream", {
    method: "POST",
    credentials: "include",
    headers: JSON_HEADERS,
    body: JSON.stringify({
      message,
      portal_session_id: sessionId || undefined,
      agent_id: agentId || undefined,
      inputs: inputs || undefined
    })
  });

  if (response.status === 401) {
    throw new Error("请先登录后再使用智能体");
  }
  if (!response.ok || !response.body) {
    throw new Error((await response.text()) || `请求失败：${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const packets = buffer.split("\n\n");
    buffer = packets.pop() || "";
    for (const packet of packets) {
      const lines = packet.split("\n").filter((line) => line.startsWith("data: "));
      for (const line of lines) {
        const raw = line.slice(6);
        if (!raw || raw === "[DONE]") continue;
        onEvent?.(JSON.parse(raw));
      }
    }
  }
}
