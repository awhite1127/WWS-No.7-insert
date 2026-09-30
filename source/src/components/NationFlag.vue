<script setup lang="ts">
defineProps<{ nation: string; label: string }>();
</script>

<template>
  <svg class="nation-flag" viewBox="0 0 24 16" role="img" :aria-label="label" xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="16" fill="#ecf1f3" />
    <template v-if="nation === 'japan'"><circle cx="12" cy="8" r="4.1" fill="#bc2635" /></template>
    <template v-else-if="nation === 'usa'">
      <rect v-for="row in 7" :key="row" y="0" width="24" height="1.25" fill="#bd303d" :transform="'translate(0 ' + (row - 1) * 2.45 + ')'" />
      <rect width="10.5" height="8.6" fill="#244477" />
      <circle v-for="dot in 9" :key="dot" :cx="1.7 + ((dot - 1) % 3) * 3.4" :cy="1.5 + Math.floor((dot - 1) / 3) * 2.8" r=".5" fill="#fff" />
    </template>
    <template v-else-if="nation === 'ussr'"><rect width="24" height="16" fill="#c93235" /><path d="M6 2.5 6.7 4.6 9 4.6 7.1 5.9 7.8 8 6 6.7 4.2 8 4.9 5.9 3 4.6 5.3 4.6Z" fill="#f6d56c" /></template>
    <template v-else-if="nation === 'germany'"><rect width="24" height="5.34" fill="#20242a" /><rect y="5.33" width="24" height="5.34" fill="#c13b40" /><rect y="10.66" width="24" height="5.34" fill="#efc95b" /></template>
    <template v-else-if="nation === 'uk'"><rect width="24" height="16" fill="#244471" /><path d="M0 0 24 16 M24 0 0 16" stroke="#fff" stroke-width="4" /><path d="M0 0 24 16 M24 0 0 16" stroke="#c62e3b" stroke-width="1.5" /><path d="M12 0v16M0 8h24" stroke="#fff" stroke-width="6" /><path d="M12 0v16M0 8h24" stroke="#c62e3b" stroke-width="3" /></template>
    <template v-else-if="nation === 'france'"><rect width="8" height="16" fill="#2459a2" /><rect x="16" width="8" height="16" fill="#d74448" /></template>
    <template v-else-if="nation === 'italy'"><rect width="8" height="16" fill="#22945d" /><rect x="16" width="8" height="16" fill="#d84a4b" /></template>
    <template v-else-if="nation === 'netherlands'"><rect width="24" height="5.34" fill="#bb3943" /><rect y="10.66" width="24" height="5.34" fill="#2d5289" /></template>
    <template v-else-if="nation === 'spain'"><rect width="24" height="16" fill="#c54339" /><rect y="4" width="24" height="8" fill="#f0c954" /><rect x="7" y="6" width="2.5" height="4" rx=".5" fill="#be4540" /></template>
    <template v-else-if="nation === 'pan_europe'"><rect width="24" height="16" fill="#27539a" /><circle v-for="dot in 8" :key="dot" :cx="12 + 4.7 * Math.cos((dot - 1) * Math.PI / 4)" :cy="8 + 4.7 * Math.sin((dot - 1) * Math.PI / 4)" r=".8" fill="#f5d568" /></template>
    <template v-else-if="nation === 'pan_asia'"><rect width="24" height="16" fill="#247d92" /><path d="M0 12Q12 5 24 12v4H0Z" fill="#e8c76e" /><circle cx="12" cy="6" r="2.8" fill="#fff" /></template>
    <template v-else-if="nation === 'commonwealth'"><rect width="24" height="16" fill="#28548a" /><path d="M0 0 12 8M12 0 0 8" stroke="#fff" stroke-width="2" /><path d="M6 0v8M0 4h12" stroke="#fff" stroke-width="2.8" /><path d="M6 0v8M0 4h12" stroke="#ce4149" stroke-width="1.4" /><circle cx="18" cy="10" r="1.6" fill="#fff" /></template>
    <template v-else-if="nation === 'pan_america'"><rect width="24" height="16" fill="#207f78" /><path d="M0 12 24 4v4L0 16Z" fill="#e4c763" /><circle cx="12" cy="8" r="2.5" fill="#fff" /></template>
    <template v-else><rect width="24" height="16" fill="#647e8b" /><circle cx="12" cy="8" r="3" fill="#fff" /></template>
  </svg>
</template>
