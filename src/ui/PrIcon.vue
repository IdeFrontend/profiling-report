<template>
  <span
    class="pr-icon"
    :class="`pr-icon--${name}`"
    aria-hidden="true"
  />
</template>

<script setup lang="ts">
/** HDesign exports under `src/ui/icons/`, stripped of Figma's invisible duplicate paths. */
export type PrIconName =
  | 'search'
  | 'zoom-in'
  | 'zoom-out'
  | 'stats'
  | 'measure'
  | 'display-config'
  | 'help'
  | 'close';

defineProps<{ name: PrIconName }>();
</script>

<style scoped>
/* Masked rather than inlined so one glyph serves every state: the button tints it
   through `currentColor` (rest `#b3b3b3` → active `#2d70e3`), which an <img> could not do. */
.pr-icon {
  box-sizing: border-box;
  flex: 0 0 16px;
  width: 16px;
  height: 16px;
  display: inline-block;
  background-color: currentColor;
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-size: contain;
  mask-size: contain;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
}

.pr-icon--search {
  -webkit-mask-image: url('./icons/search.svg');
  mask-image: url('./icons/search.svg');
}

.pr-icon--zoom-in {
  -webkit-mask-image: url('./icons/zoom-in.svg');
  mask-image: url('./icons/zoom-in.svg');
}

.pr-icon--zoom-out {
  -webkit-mask-image: url('./icons/zoom-out.svg');
  mask-image: url('./icons/zoom-out.svg');
}

.pr-icon--stats {
  -webkit-mask-image: url('./icons/stats.svg');
  mask-image: url('./icons/stats.svg');
}

.pr-icon--measure {
  -webkit-mask-image: url('./icons/measure.svg');
  mask-image: url('./icons/measure.svg');
}

.pr-icon--display-config {
  -webkit-mask-image: url('./icons/display-config.svg');
  mask-image: url('./icons/display-config.svg');
}

.pr-icon--help {
  -webkit-mask-image: url('./icons/help.svg');
  mask-image: url('./icons/help.svg');
}

.pr-icon--close {
  -webkit-mask-image: url('./icons/close.svg');
  mask-image: url('./icons/close.svg');
}
</style>
