<script setup lang="ts">
import { ref } from "vue";
import AppIcon from "./AppIcon.vue";
import type { AppConfig, WgAuthStatus } from "../types";

const props = withDefaults(defineProps<{
  realm: AppConfig["realm"];
  onboarding?: boolean;
  featureName?: string;
  headline?: string;
}>(), { onboarding: false, featureName: "助手功能", headline: "" });
const emit = defineEmits<{
  authorized: [status: WgAuthStatus];
  skip: [];
}>();
const selectedRealm = ref<AppConfig["realm"]>(props.realm);
const loading = ref(false);
const error = ref("");

async function login() {
  loading.value = true;
  error.value = "";
  try {
    emit("authorized", await window.wws.loginWg(selectedRealm.value));
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <section class="wg-auth-gate panel" :class="{ 'wg-auth-gate--onboarding': onboarding }">
    <div class="wg-auth-gate__copy">
      <span class="section-kicker"><AppIcon name="shield" :size="16" />WG ACCOUNT</span>
      <h2>{{ onboarding ? '先连接你的 WG 账号。' : (headline || `${featureName}需要账号授权。`) }}</h2>
      <p>授权后才能读取自己的战绩和港口舰船数据。登录由 WG 官方页面完成，软件不会接触你的密码；访问令牌只加密保存在本机。</p>
      <div class="wg-auth-gate__realms">
        <button v-for="item in ['asia', 'eu', 'na']" :key="item" :class="{ active: selectedRealm === item }" @click="selectedRealm = item as AppConfig['realm']">{{ item.toUpperCase() }}</button>
      </div>
      <div class="wg-auth-gate__actions">
        <button class="button-primary" :disabled="loading" @click="login"><AppIcon name="shield" :size="17" />{{ loading ? '等待 WG 授权' : '前往 WG 官方授权' }}</button>
        <button v-if="onboarding" class="button-secondary" :disabled="loading" @click="emit('skip')">暂不授权</button>
      </div>
      <p v-if="error" class="error-message">{{ error }}</p>
    </div>
    <div class="wg-auth-gate__benefits">
      <article><b>01</b><span><strong>我的战绩</strong><small>自动打开当前授权账号的总体与单舰数据</small></span></article>
      <article><b>02</b><span><strong>港口扫雪</strong><small>读取舰船清单并计算活动奖励</small></span></article>
      <article><b>03</b><span><strong>本机加密</strong><small>随时可以在扫雪页面退出并撤销授权</small></span></article>
    </div>
  </section>
</template>
