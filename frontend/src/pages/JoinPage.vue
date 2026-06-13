<script setup>
import { ref } from "vue";
import { submitJoin } from "../api/portal";

const roles = ["产品体验官", "智能体共建", "数据场景共建", "技术开发"];
const role = ref(roles[0]);
const reason = ref("");
const message = ref("");
const submitting = ref(false);

async function submit() {
  if (!reason.value.trim()) {
    message.value = "请简单说明你想参与的方向";
    return;
  }
  submitting.value = true;
  message.value = "";
  try {
    await submitJoin({ role: role.value, reason: reason.value });
    reason.value = "";
    message.value = "报名已提交";
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
      <h1>加入共建</h1>
      <p>一起把农芯智做成更懂校园的 AI 产品。</p>
    </section>
    <form class="plain-form" @submit.prevent="submit">
      <label>参与方向</label>
      <div class="segmented">
        <button v-for="item in roles" :key="item" type="button" :class="{ active: role === item }" @click="role = item">{{ item }}</button>
      </div>
      <label>说明</label>
      <textarea v-model="reason" rows="8" placeholder="说说你的方向、资源或想法"></textarea>
      <button type="submit" :disabled="submitting">提交报名</button>
      <p class="form-message">{{ message }}</p>
    </form>
  </main>
</template>
