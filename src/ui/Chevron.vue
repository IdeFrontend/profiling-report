<template>
  <span
    class="pr-chevron"
    :class="`pr-chevron--${direction ?? (expanded ? 'down' : 'right')}`"
    aria-hidden="true"
  />
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    /** True = expanded (chevron points down); false = collapsed (points right). */
    expanded?: boolean;
    /** Overrides `expanded` where the arrow is not a disclosure — a stepper, say. */
    direction?: 'up' | 'down' | 'right';
  }>(),
  { expanded: true, direction: undefined },
);
</script>

<style scoped>
.pr-chevron {
  box-sizing: border-box;
  flex: 0 0 10px;
  width: 10px;
  height: 10px;
  display: inline-block;
  position: relative;
  color: #a8a8a8;
}

.pr-chevron::before {
  content: '';
  position: absolute;
  box-sizing: border-box;
  border-style: solid;
  border-color: currentColor;
  border-width: 0 1.2px 1.2px 0;
  width: 5px;
  height: 5px;
}

.pr-chevron--down::before {
  top: 1px;
  left: 2px;
  transform: rotate(45deg);
}

.pr-chevron--right::before {
  top: 2px;
  left: 1px;
  transform: rotate(-45deg);
}

.pr-chevron--up::before {
  top: 3px;
  left: 2px;
  transform: rotate(-135deg);
}
</style>
