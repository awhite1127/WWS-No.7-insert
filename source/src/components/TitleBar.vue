<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import AppIcon from "./AppIcon.vue";
import appIcon from "../assets/app-icon.png";

const maximized = ref(false);
let removeWindowStateListener: (() => void) | undefined;

function minimize() {
  void window.wws.minimizeWindow();
}

async function toggleMaximize() {
  maximized.value = await window.wws.toggleMaximizeWindow();
}

function close() {
  void window.wws.closeWindow();
}

onMounted(async () => {
  maximized.value = await window.wws.isWindowMaximized();
  removeWindowStateListener = window.wws.onWindowMaximized((value) => (maximized.value = value));
});

onUnmounted(() => removeWindowStateListener?.());
</script>

<template>
  <header class="titlebar" @dblclick="toggleMaximize">
    <div class="titlebar__identity">
      <img class="titlebar__app-icon" :src="appIcon" alt="" />
      <strong>No. 7 insert</strong>
      <span class="titlebar__divider"></span>
      <span>战绩情报终端</span>
    </div>
    <div class="titlebar__drag"></div>
    <div class="titlebar__health"><i></i><span>服务在线</span></div>
    <div class="window-controls" @dblclick.stop>
      <button aria-label="最小化" title="最小化" @click="minimize"><AppIcon name="minus" :size="15" /></button>
      <button :aria-label="maximized ? '还原' : '最大化'" :title="maximized ? '还原' : '最大化'" @click="toggleMaximize">
        <AppIcon :name="maximized ? 'restore' : 'maximize'" :size="13" />
      </button>
      <button class="window-control--close" aria-label="关闭" title="关闭" @click="close"><AppIcon name="close" :size="16" /></button>
    </div>
  </header>
</template>
