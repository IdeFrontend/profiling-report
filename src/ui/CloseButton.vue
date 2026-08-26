<template>
  <button
    type="button"
    class="pr-close"
    :aria-label="label"
    :title="label"
  >
    <!-- Sketch draws a stroked ✕, not the typographic × — that glyph sits on the
         font's math axis, so it never optically centers in its own button. -->
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      aria-hidden="true"
    >
      <path
        d="M1 1L11 11M11 1L1 11"
        fill="none"
        stroke="currentColor"
        stroke-width="1.3"
        stroke-linecap="round"
      />
    </svg>
  </button>
</template>

<script setup lang="ts">
defineProps<{
  /** Localized name for both `aria-label` and `title`. */
  label: string;
}>();
</script>

<style scoped>
.pr-close {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 20px;
  height: 20px;
  margin: 0;
  padding: 0;
  appearance: none;
  border: 0;
  background: transparent;
  color: #e6e6e6;
  line-height: 0;
  cursor: pointer;
}

.pr-close:hover {
  color: #ffffff;
}
</style>
