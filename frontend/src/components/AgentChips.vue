<script setup>
import { CAMPUS_AGENTS } from "../api/portal";

const selected = defineModel({ type: String, default: "" });

function toggle(id) {
  selected.value = selected.value === id ? "" : id;
}
</script>

<template>
  <div class="agent-chips" aria-label="智能体选择">
    <button
      v-for="agent in CAMPUS_AGENTS"
      :key="agent.id"
      type="button"
      :class="{ active: selected === agent.id }"
      @click="toggle(agent.id)"
    >
      {{ agent.name }}
    </button>
  </div>
</template>
