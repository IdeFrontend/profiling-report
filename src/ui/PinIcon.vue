<template>
  <span
    class="pr-pin"
    :class="{ 'pr-pin--filled': filled }"
    aria-hidden="true"
  />
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    /** Solid fill (pinned / pin hover); outline when false. */
    filled?: boolean;
  }>(),
  { filled: false },
);
</script>

<style scoped>
/* 10×10 box matching Chevron; glyph from src/ui/icons/pushpin*.svg (PyPTO/DevUI). */
.pr-pin {
  box-sizing: border-box;
  flex: 0 0 10px;
  width: 10px;
  height: 10px;
  display: inline-block;
  color: #a8a8a8;
  background-color: currentColor;
  -webkit-mask: url('./icons/pushpin.svg') center / contain no-repeat;
  mask: url('./icons/pushpin.svg') center / contain no-repeat;
}

.pr-pin--filled {
  color: #4a90e2;
  -webkit-mask-image: url('./icons/pushpin-fill.svg');
  mask-image: url('./icons/pushpin-fill.svg');
}
</style>
