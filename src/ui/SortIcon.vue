<script setup lang="ts">
defineProps<{
  direction: 'asc' | 'desc' | null;
}>();
</script>

<template>
  <!-- Unsorted: up-triangle + 1px divider + down-triangle -->
  <svg
    v-if="direction === null"
    data-testid="sort-icon-none"
    viewBox="0 0 10 14"
    width="10"
    height="14"
    aria-hidden="true"
    fill="currentColor"
  >
    <path d="M5 1 L9 6 L1 6 Z" />
    <rect x="1" y="7" width="8" height="1" />
    <path d="M5 13 L1 8 L9 8 Z" />
  </svg>

  <!-- Ascending: up-triangle only -->
  <svg
    v-else-if="direction === 'asc'"
    data-testid="sort-icon-asc"
    viewBox="0 0 10 7"
    width="10"
    height="7"
    aria-hidden="true"
    fill="currentColor"
  >
    <path d="M5 1 L9 6 L1 6 Z" />
  </svg>

  <!-- Descending: down-triangle only -->
  <svg
    v-else
    data-testid="sort-icon-desc"
    viewBox="0 0 10 7"
    width="10"
    height="7"
    aria-hidden="true"
    fill="currentColor"
  >
    <path d="M5 6 L1 1 L9 1 Z" />
  </svg>
</template>
