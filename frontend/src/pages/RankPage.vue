<script setup>
import { onMounted, ref, watch } from "vue";
import { getRankings } from "../api/portal";

const type = ref("student");
const period = ref("all");
const metric = ref("effective_runs");
const items = ref([]);
const me = ref({ rank: 0, score: 0 });
const loading = ref(false);

async function load() {
  loading.value = true;
  try {
    const data = await getRankings({ type: type.value, period: period.value, metric: metric.value });
    items.value = data.items || [];
    me.value = data.me || { rank: 0, score: 0 };
  } finally {
    loading.value = false;
  }
}

watch([type, period, metric], load);
onMounted(load);
</script>

<template>
  <main class="rank-page">
    <section class="page-title">
      <h1>排行榜</h1>
      <p>展示校园 AI 使用活跃度和 Token 消耗情况。</p>
    </section>
    <div class="toolbar">
      <button :class="{ active: type === 'student' }" @click="type = 'student'">学生榜</button>
      <button :class="{ active: type === 'teacher' }" @click="type = 'teacher'">教师榜</button>
      <button :class="{ active: metric === 'effective_runs' }" @click="metric = 'effective_runs'">使用次数</button>
      <button :class="{ active: metric === 'total_tokens' }" @click="metric = 'total_tokens'">Token</button>
      <select v-model="period">
        <option value="all">总榜</option>
        <option value="30d">近30天</option>
        <option value="7d">近7天</option>
        <option value="today">今日</option>
      </select>
    </div>
    <section class="rank-card">
      <div class="my-rank">我的排名：{{ me.rank || '-' }}，分数：{{ me.score || 0 }}</div>
      <ol class="big-rank-list">
        <li v-for="item in items" :key="item.id">
          <span class="rank-num">{{ item.rank }}</span>
          <strong>{{ item.name }}</strong>
          <small>{{ item.college }} · {{ item.major }}</small>
          <b>{{ item.count }}</b>
        </li>
      </ol>
      <p v-if="loading" class="muted">正在加载...</p>
    </section>
  </main>
</template>
