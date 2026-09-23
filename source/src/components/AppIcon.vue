<script setup lang="ts">
defineProps<{ name: string; size?: number; strokeWidth?: number }>();
</script>

<template>
  <svg
    class="app-icon"
    :width="size ?? 18"
    :height="size ?? 18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth ?? 1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <template v-if="name === 'user'">
      <circle cx="12" cy="8" r="3.25" />
      <path d="M5.5 19c.65-3.15 3.05-5 6.5-5s5.85 1.85 6.5 5" />
    </template>
    <template v-else-if="name === 'clan'">
      <circle cx="9" cy="8" r="2.7" />
      <circle cx="16.5" cy="9.5" r="2.1" />
      <path d="M3.7 18c.45-3 2.5-4.7 5.3-4.7 2.85 0 4.9 1.7 5.35 4.7M14.4 14.2c2.8-.45 5.1 1.1 5.65 3.8" />
    </template>
    <template v-else-if="name === 'overlay'">
      <rect x="3.5" y="4" width="17" height="16" rx="2.5" />
      <path d="M7 8h4M7 12h10M7 16h7" />
      <circle cx="17" cy="8" r="1" fill="currentColor" stroke="none" />
    </template>
    <template v-else-if="name === 'snow'">
      <path d="M12 2.5v19M3.8 7.2l16.4 9.6M20.2 7.2 3.8 16.8M8.8 4.4 12 7.1l3.2-2.7M8.8 19.6l3.2-2.7 3.2 2.7M4.1 11.2l3.9-1.1-.7-4M19.9 12.8 16 13.9l.7 4M19.9 11.2 16 10.1l.7-4M4.1 12.8 8 13.9l-.7 4" />
    </template>
    <template v-else-if="name === 'settings'">
      <circle cx="12" cy="12" r="3" />
      <path d="M19 13.5v-3l-2-.7a7 7 0 0 0-.65-1.55l.9-1.9-2.1-2.1-1.9.9A7 7 0 0 0 11.5 4l-.7-2h-3l-.7 2a7 7 0 0 0-1.55.65l-1.9-.9-2.1 2.1.9 1.9A7 7 0 0 0 1.8 9.5l-2 .7v3l2 .7a7 7 0 0 0 .65 1.55l-.9 1.9 2.1 2.1 1.9-.9a7 7 0 0 0 1.55.65l.7 2h3l.7-2a7 7 0 0 0 1.55-.65l1.9.9 2.1-2.1-.9-1.9A7 7 0 0 0 19 13.5Z" transform="translate(2.2 0) scale(.82)" />
    </template>
    <template v-else-if="name === 'search'">
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="m15 15 4.5 4.5" />
    </template>
    <template v-else-if="name === 'history'">
      <path d="M4.5 8.5H1.8V5.8" />
      <path d="M3 8a9 9 0 1 1 1 9.6M12 7v5l3.3 2" />
    </template>
    <template v-else-if="name === 'database'">
      <ellipse cx="12" cy="5.5" rx="7.5" ry="3" />
      <path d="M4.5 5.5v6c0 1.65 3.35 3 7.5 3s7.5-1.35 7.5-3v-6M4.5 11.5v6c0 1.65 3.35 3 7.5 3s7.5-1.35 7.5-3v-6" />
    </template>
    <template v-else-if="name === 'pulse'">
      <path d="M3 12h4l2.1-5 4.1 10 2.1-5H21" />
    </template>
    <template v-else-if="name === 'keyboard'">
      <rect x="2.5" y="5.5" width="19" height="13" rx="2.5" />
      <path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M6 13.5h.01M9.5 13.5h.01M13 13.5h5M6 16h8" />
    </template>
    <template v-else-if="name === 'shield'">
      <path d="M12 2.8 19 6v5.1c0 4.3-2.7 7.8-7 10.1-4.3-2.3-7-5.8-7-10.1V6l7-3.2Z" />
      <path d="m8.8 12 2 2 4.5-4.5" />
    </template>
    <template v-else-if="name === 'folder'">
      <path d="M3 6.5h6l2 2h10v9.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6.5Z" />
      <path d="M3 9h18" />
    </template>
    <template v-else-if="name === 'eye'">
      <path d="M2.7 12s3.35-5.2 9.3-5.2 9.3 5.2 9.3 5.2-3.35 5.2-9.3 5.2S2.7 12 2.7 12Z" />
      <circle cx="12" cy="12" r="2.4" />
    </template>
    <template v-else-if="name === 'arrow'">
      <path d="M5 12h14M14 7l5 5-5 5" />
    </template>
    <template v-else-if="name === 'chevron'">
      <path d="m9 6 6 6-6 6" />
    </template>
    <template v-else-if="name === 'minus'">
      <path d="M6 12h12" />
    </template>
    <template v-else-if="name === 'maximize'">
      <rect x="5" y="5" width="14" height="14" rx="1" />
    </template>
    <template v-else-if="name === 'restore'">
      <path d="M8 8V5h11v11h-3M5 8h11v11H5z" />
    </template>
    <template v-else-if="name === 'close'">
      <path d="m7 7 10 10M17 7 7 17" />
    </template>
    <template v-else>
      <circle cx="12" cy="12" r="8" />
    </template>
  </svg>
</template>
