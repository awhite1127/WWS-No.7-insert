<script setup lang="ts">
import AppIcon from "./AppIcon.vue";
import type { ClanSearchResult, SearchResult } from "../types";

defineProps<{
  mode: "player" | "clan";
  modelValue: string;
  realm: string;
  searching: boolean;
  suggestions: SearchResult[];
  clanSuggestions: ClanSearchResult[];
  error: string;
  compact?: boolean;
}>();
const emit = defineEmits<{
  "update:modelValue": [value: string];
  submit: [];
  selectPlayer: [accountId: number];
  selectClan: [clanId: number];
}>();
</script>

<template>
  <div class="search-control" :class="{ 'search-control--compact': compact }">
    <form class="search-box" :aria-busy="searching" @submit.prevent="emit('submit')">
      <AppIcon name="search" :size="compact ? 16 : 20" />
      <input :value="modelValue" :placeholder="mode === 'player' ? '玩家昵称 / UID' : '军团标签 / 名称'" aria-label="查询关键词" @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)" />
      <span v-if="!compact" class="search-box__realm">{{ realm.toUpperCase() }}</span>
      <button type="submit" :disabled="searching" :aria-label="searching ? '正在检索' : '开始查询'">
        <span>{{ searching ? '正在检索' : '开始查询' }}</span><span v-if="searching" class="ui-spinner" aria-hidden="true"></span><AppIcon v-else name="arrow" :size="compact ? 14 : 17" />
      </button>
    </form>
    <div v-if="suggestions.length" class="suggestions">
      <button v-for="match in suggestions" :key="match.account_id" type="button" @click="emit('selectPlayer', match.account_id)">
        <span class="suggestion-avatar">{{ match.nickname.slice(0, 1).toUpperCase() }}</span>
        <strong>{{ match.nickname }}</strong><span>UID {{ match.account_id }}</span><AppIcon name="arrow" :size="15" />
      </button>
    </div>
    <div v-if="clanSuggestions.length" class="suggestions">
      <button v-for="match in clanSuggestions" :key="match.clan_id" type="button" @click="emit('selectClan', match.clan_id)">
        <span class="suggestion-avatar">{{ match.tag.slice(0, 1) }}</span>
        <strong>[{{ match.tag }}] {{ match.name }}</strong><span>{{ match.members_count }} 名成员</span><AppIcon name="arrow" :size="15" />
      </button>
    </div>
    <p v-if="error" class="error-message" role="alert">{{ error }}</p>
  </div>
</template>
