<script setup>
import { ref } from "vue";
import { submitFeedback } from "../api/portal";

const topics = ["回答不准确", "功能建议", "界面体验", "数据问题", "其他"];
const topic = ref(topics[0]);
const content = ref("");
const message = ref("");
const submitting = ref(false);

async function submit() {
  if (!content.value.trim()) {
    message.value = "请先填写反馈内容";
    return;
  }
  submitting.value = true;
  message.value = "";
  try {
    await submitFeedback({ topic: topic.value, content: content.value });
    content.value = "";
    message.value = "反馈已提交";
  } catch (error) {
    message.value = error.message;
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <main class="form-page">
    <section class="page-title">
      <h1>反馈</h1>
      <p>告诉我们哪里不好用，项目团队会持续优化。</p>
    </section>
    <form class="plain-form" @submit.prevent="submit">
      <label>反馈类型</label>
      <div class="segmented">
        <button v-for="item in topics" :key="item" type="button" :class="{ active: topic === item }" @click="topic = item">{{ item }}</button>
      </div>
      <label>反馈内容</label>
      <textarea v-model="content" rows="8" placeholder="请描述遇到的问题或建议"></textarea>
      <button type="submit" :disabled="submitting">提交反馈</button>
      <p class="form-message">{{ message }}</p>
    </form>
  </main>
</template>
