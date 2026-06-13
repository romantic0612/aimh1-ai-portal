<script setup>
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { CAMPUS_AGENTS, getAgents } from "../api/portal";

const router = useRouter();
const externalAgents = ref([]);

function openCampus(agentId) {
  router.push({ path: "/chat", query: { agent_id: agentId } });
}

function openExternal(url) {
  if (url) window.open(url, "_blank", "noopener");
}

onMounted(async () => {
  const data = await getAgents();
  externalAgents.value = data.agents || [];
});
</script>

<template>
  <main class="agents-page">
    <section class="page-title">
      <h1>智能体中心</h1>
      <p>按校园场景选择智能体，后续可以在这里扩展、排序和下线能力。</p>
    </section>
    <section class="agent-grid">
      <article v-for="agent in CAMPUS_AGENTS" :key="agent.id" class="agent-card large" @click="openCampus(agent.id)">
        <span>校内智能体</span>
        <h2>{{ agent.name }}</h2>
        <p>{{ agent.summary }}</p>
        <button type="button">进入对话</button>
      </article>
      <article v-for="agent in externalAgents" :key="agent.id" class="agent-card external" @click="openExternal(agent.targetUrl)">
        <span>{{ agent.status || '外部系统' }}</span>
        <h2>{{ agent.name }}</h2>
        <p>{{ agent.detail }}</p>
        <button type="button">打开</button>
      </article>
    </section>
  </main>
</template>
