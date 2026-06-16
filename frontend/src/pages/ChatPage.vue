<script setup>
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import AgentChips from "../components/AgentChips.vue";
import MarkdownView from "../components/MarkdownView.vue";
import {
  clearChatHistory,
  deleteChatHistory,
  getChatHistory,
  getChatHistoryDetail,
  streamChat
} from "../api/portal";

const route = useRoute();
const router = useRouter();
const draft = ref("");
const selectedAgent = ref(["jiaowu", "library", "xg", "data", "service"].includes(String(route.query.agent_id || "")) ? String(route.query.agent_id) : "");
const sessionId = ref("");
const history = ref([]);
const messages = ref([]);
const loading = ref(false);
const historyMode = ref(false);
const chatWindow = ref(null);

const activeTitle = computed(() => {
  if (selectedAgent.value === "jiaowu") return "教务智能体";
  if (selectedAgent.value === "library") return "AI馆员";
  if (selectedAgent.value === "xg") return "AI辅导员";
  if (selectedAgent.value === "data") return "AI问数";
  if (selectedAgent.value === "service") return "AI办事";
  return "农芯智 AI";
});

function addMessage(role, text = "", type = "") {
  const item = { id: `${Date.now()}-${Math.random()}`, role, text, type, serviceCards: [] };
  messages.value.push(item);
  scrollBottom();
  return item;
}

function appendMessage(item, text) {
  if (!item || !text) return;
  item.text += text;
  scrollBottom();
}

function scrollBottom() {
  nextTick(() => {
    if (chatWindow.value) chatWindow.value.scrollTop = chatWindow.value.scrollHeight;
  });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function normalizeServiceCards(value) {
  return (Array.isArray(value) ? value : []).filter((card) => card && typeof card === "object");
}

function renderServiceCards(cards = []) {
  const items = normalizeServiceCards(cards);
  if (!items.length) return "";
  return items.map((card) => {
    const materials = Array.isArray(card.materials) ? card.materials.filter(Boolean) : [];
    const steps = Array.isArray(card.processSteps) ? card.processSteps.filter(Boolean) : [];
    const entryUrl = card.entryUrl || card.entry_url || card.url || "";
    return `
      <section class="service-card">
        <div class="service-card-head">
          <span>${escapeHtml(card.category || "办事事项")}</span>
          <strong>${escapeHtml(card.title || card.name || "未命名事项")}</strong>
        </div>
        ${card.description ? `<p>${escapeHtml(card.description)}</p>` : ""}
        ${card.department ? `<small>办理部门：${escapeHtml(card.department)}</small>` : ""}
        ${materials.length ? `<div><b>所需材料</b><ul>${materials.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>` : ""}
        ${steps.length ? `<div><b>办理流程</b><ol>${steps.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol></div>` : ""}
        ${card.notice ? `<em>${escapeHtml(card.notice)}</em>` : ""}
        ${entryUrl ? `<a href="${escapeHtml(entryUrl)}" target="_blank" rel="noopener noreferrer">立即办理</a>` : ""}
      </section>
    `;
  }).join("");
}

async function loadHistory() {
  try {
    const data = await getChatHistory();
    history.value = data.data?.sessionList || [];
  } catch {
    history.value = [];
  }
}

async function openHistory(item) {
  const data = await getChatHistoryDetail(item.sessionId);
  sessionId.value = data.data.sessionId;
  historyMode.value = true;
  messages.value = (data.data.chatList || []).map((message) => ({
    id: `${Date.now()}-${Math.random()}`,
    role: message.type === "user" ? "user" : "assistant",
    text: message.content || "",
    type: "history"
  }));
  scrollBottom();
}

async function removeHistory(item) {
  if (!window.confirm("删除这条对话？")) return;
  await deleteChatHistory(item.sessionId);
  if (sessionId.value === item.sessionId) startNew();
  await loadHistory();
}

async function clearAllHistory() {
  if (!history.value.length || !window.confirm("清空全部历史记录？")) return;
  await clearChatHistory();
  startNew();
  await loadHistory();
}

function startNew() {
  sessionId.value = "";
  messages.value = [];
  historyMode.value = false;
  draft.value = "";
}

async function send(text = draft.value) {
  const message = String(text || "").trim();
  if (!message || loading.value) return;
  if (historyMode.value) {
    addMessage("assistant", "历史记录仅供查看，请新建对话后继续提问。", "error");
    return;
  }
  draft.value = "";
  addMessage("user", message);
  const assistant = addMessage("assistant", "", "thinking");
  loading.value = true;

  try {
    await streamChat({
      message,
      sessionId: sessionId.value,
      agentId: selectedAgent.value,
      onEvent(event) {
        if (event.portal_session_id) sessionId.value = event.portal_session_id;
        if (event.type === "answer_chunk") {
          assistant.type = "answer";
          appendMessage(assistant, event.content || "");
        } else if (event.type === "tool_result" && event.tool_name === "call_service_navigator") {
          assistant.type = "answer";
          assistant.serviceCards = normalizeServiceCards(event.data?.service_cards || event.data?.serviceCards);
          scrollBottom();
        } else if (event.answer && !assistant.text) {
          assistant.type = "answer";
          assistant.text = event.answer;
        } else if (event.type === "error") {
          assistant.type = "error";
          assistant.text = event.content || "智能体调用失败。";
        }
      }
    });
    if (!assistant.text.trim()) assistant.text = "智能体已完成处理，但没有返回文本内容。";
  } catch (error) {
    assistant.type = "error";
    assistant.text = error.message || "请求失败";
    if (/登录/.test(assistant.text)) setTimeout(() => { window.location.href = "/api/auth/login"; }, 900);
  } finally {
    loading.value = false;
    loadHistory();
    scrollBottom();
  }
}

onMounted(() => {
  loadHistory();
  if (route.query.session_id) {
    openHistory({ sessionId: String(route.query.session_id) }).catch(() => {});
  }
});

watch(
  () => route.query.q,
  (value) => {
    if (value) {
      router.replace({ path: "/chat", query: selectedAgent.value ? { agent_id: selectedAgent.value } : {} });
      send(String(value));
    }
  },
  { immediate: true }
);
</script>

<template>
  <main class="chat-page">
    <aside class="history-sidebar">
      <div class="history-head">
        <h2>历史记录</h2>
        <button type="button" @click="clearAllHistory">清空</button>
        <button type="button" @click="startNew">新对话</button>
      </div>
      <button
        v-for="item in history"
        :key="item.sessionId"
        type="button"
        :class="['history-item', { active: sessionId === item.sessionId }]"
        @click="openHistory(item)"
      >
        <strong>{{ item.sessionTitle || '历史会话' }}</strong>
        <span>{{ item.displayTime || item.updateTime }}</span>
        <em @click.stop="removeHistory(item)">删除</em>
      </button>
    </aside>

    <section class="chat-shell">
      <div ref="chatWindow" class="chat-window">
        <article class="message assistant intro" v-if="!messages.length">
          <MarkdownView :text="`### ${activeTitle}\n\n请选择智能体或直接输入问题，我会根据当前入口调用对应能力。`" />
        </article>
        <article v-for="message in messages" :key="message.id" :class="['message', message.role, message.type]">
          <div v-if="message.role === 'user'" class="user-bubble">{{ message.text }}</div>
          <template v-else>
            <MarkdownView :text="message.text || (loading ? '正在处理...' : '')" />
            <div v-if="message.serviceCards?.length" class="service-card-list" v-html="renderServiceCards(message.serviceCards)"></div>
          </template>
        </article>
      </div>

      <div class="chat-controls" v-if="!historyMode">
        <AgentChips v-model="selectedAgent" />
        <form class="chat-composer" @submit.prevent="send()">
          <input v-model="draft" type="search" :placeholder="loading ? '处理中' : '继续输入问题，回车发送'" />
          <button type="submit" :disabled="loading">发送</button>
        </form>
      </div>
      <div class="history-readonly" v-else>历史记录仅供查看，请先新建对话</div>
    </section>
  </main>
</template>
