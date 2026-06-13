<script setup>
import { computed, onMounted, ref } from "vue";
import { RouterLink, RouterView, useRoute } from "vue-router";
import { getSession } from "./api/portal";

const route = useRoute();
const session = ref({ authenticated: false, user: null });
const loading = ref(true);

const isMobileShell = computed(() => route.path.startsWith("/mobile"));

onMounted(async () => {
  try {
    session.value = await getSession(route.fullPath);
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div :class="['app-shell', { 'mobile-shell': isMobileShell }]">
    <header class="site-header">
      <RouterLink class="brand" to="/">
        <img src="/文化标识.png" alt="安徽农业大学" />
        <span class="brand-divider"></span>
        <strong>农芯智 <small>v1.0</small></strong>
      </RouterLink>
      <nav class="main-nav" aria-label="主导航">
        <RouterLink to="/">首页</RouterLink>
        <RouterLink to="/agents">智能体中心</RouterLink>
        <RouterLink to="/mobile/rank">排行榜</RouterLink>
        <RouterLink to="/feedback">反馈</RouterLink>
      </nav>
      <div class="user-pill">
        <span v-if="loading">校验中</span>
        <span v-else-if="session.authenticated">{{ session.user?.name || session.user?.user_name || session.user?.user_id }}</span>
        <a v-else href="/api/auth/login">登录</a>
      </div>
    </header>
    <RouterView />
  </div>
</template>
