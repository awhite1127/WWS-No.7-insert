<script setup lang="ts">
withDefaults(defineProps<{ label?: string; detail?: string }>(), {
  label: "正在读取战绩…",
  detail: "正在连接 WG 数据并整理统计结果",
});
</script>

<template>
  <div class="loading-state" role="status" aria-live="polite">
    <div class="loading-orbit" aria-hidden="true"><i></i><i></i><i></i><span></span></div>
    <strong>{{ label }}</strong>
    <span>{{ detail }}</span>
    <div class="loading-progress" aria-hidden="true"><i></i></div>
  </div>
</template>
