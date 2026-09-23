<script setup lang="ts">
defineProps<{ label: string; value: string; hint?: string; tone?: "good" | "warn" | "plain" }>();
</script>

<template>
  <div class="stat-card" :class="`stat-card--${tone ?? 'plain'}`">
    <span>{{ label }}</span>
    <strong>{{ value }}</strong>
    <small v-if="hint">{{ hint }}</small>
  </div>
</template>

