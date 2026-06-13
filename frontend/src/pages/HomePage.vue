<script setup>
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import AgentChips from "../components/AgentChips.vue";
import { CAMPUS_AGENTS, getAnnouncements, getRankings } from "../api/portal";

const router = useRouter();
const question = ref("");
const selectedAgent = ref("");
const announcements = ref([]);
const usageBoard = ref([]);
const tokenBoard = ref([]);

function ask() {
  const q = question.value.trim();
  if (!q) return;
  router.push({
    path: "/chat",
    query: {
      q,
      ...(selectedAgent.value ? { agent_id: selectedAgent.value } : {})
    }
  });
}

function openAgent(agentId) {
  selectedAgent.value = agentId;
  router.push({ path: "/chat", query: { agent_id: agentId } });
}

onMounted(async () => {
  const [noticeData, usageData, tokenData] = await Promise.all([
    getAnnouncements(),
    getRankings({ type: "student", period: "all", metric: "effective_runs" }).catch(() => ({ items: [] })),
    getRankings({ type: "student", period: "all", metric: "total_tokens" }).catch(() => ({ items: [] }))
  ]);
  announcements.value = noticeData.announcements || [];
  usageBoard.value = usageData.items || [];
  tokenBoard.value = tokenData.items || [];
});
</script>

<template>
  <main class="home-page">
    <section class="hero">
      <div class="hero-copy">
        <h1>你好，我是农芯智 AI</h1>
        <p>潜岳苍苍，江淮汤汤。脚踏实地，强农先锋。</p>
      </div>
      <form class="composer-card" @submit.prevent="ask">
        <div class="composer-row">
          <img src="/logo.png" alt="" />
          <input v-model="question" type="search" placeholder="给农芯智 AI 发送消息" />
          <button type="submit">发送</button>
        </div>
        <AgentChips v-model="selectedAgent" />
      </form>
    </section>

    <section class="quick-grid">
      <article v-for="agent in CAMPUS_AGENTS" :key="agent.id" class="agent-card" @click="openAgent(agent.id)">
        <span>{{ agent.shortName }}</span>
        <h2>{{ agent.name }}</h2>
        <p>{{ agent.summary }}</p>
      </article>
    </section>

    <section class="dashboard-grid">
      <article class="panel">
        <div class="panel-head">
          <h2>使用次数排行榜</h2>
          <span>学生榜</span>
        </div>
        <ol class="rank-list">
          <li v-for="item in usageBoard.slice(0, 6)" :key="item.id">
            <strong>{{ item.rank }}. {{ item.name }}</strong>
            <span>{{ item.count }}</span>
          </li>
        </ol>
      </article>
      <article class="panel">
        <div class="panel-head">
          <h2>Token 总消耗榜</h2>
          <span>学生榜</span>
        </div>
        <ol class="rank-list">
          <li v-for="item in tokenBoard.slice(0, 6)" :key="item.id">
            <strong>{{ item.rank }}. {{ item.name }}</strong>
            <span>{{ item.count }}</span>
          </li>
        </ol>
      </article>
      <article class="panel">
        <div class="panel-head">
          <h2>校园公告</h2>
          <span>{{ announcements.length }}</span>
        </div>
        <ul class="notice-list">
          <li v-for="item in announcements.slice(0, 6)" :key="item.id">
            <strong>{{ item.title }}</strong>
            <span>{{ item.date }}</span>
          </li>
          <li v-if="!announcements.length">暂无公告</li>
        </ul>
      </article>
    </section>
  </main>
</template>
