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
    /** Solid fill (pinned / hover); outline when false. */
    filled?: boolean;
  }>(),
  { filled: false },
);
</script>

<style scoped>
/* Pushpin: flat head, tapered body, point — 10×10 box matching Chevron. */
.pr-pin {
  box-sizing: border-box;
  flex: 0 0 10px;
  width: 10px;
  height: 10px;
  display: inline-block;
  position: relative;
  color: #a8a8a8;
}

.pr-pin--filled {
  color: #4a90e2;
}

.pr-pin::before {
  content: '';
  position: absolute;
  left: 2px;
  top: 1px;
  width: 6px;
  height: 4px;
  border: 1.2px solid currentColor;
  border-radius: 1px 1px 0 0;
  background: transparent;
  box-sizing: border-box;
}

.pr-pin--filled::before {
  background: currentColor;
  border-color: currentColor;
}

.pr-pin::after {
  content: '';
  position: absolute;
  left: 4.4px;
  top: 4px;
  width: 0;
  height: 0;
  border-left: 0.8px solid transparent;
  border-right: 0.8px solid transparent;
  border-top: 5px solid currentColor;
}
</style>
