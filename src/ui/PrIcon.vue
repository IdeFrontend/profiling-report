<template>
  <span
    class="pr-icon"
    :class="`pr-icon--${name}`"
    aria-hidden="true"
  />
</template>

<script setup lang="ts">
/** Glyph masks under `src/ui/icons/` (HDesign SVGs + Source-sketch PNG samples). */
export type PrIconName =
  | 'search'
  | 'zoom-in'
  | 'zoom-out'
  | 'stats'
  | 'measure'
  | 'display-config'
  | 'help'
  | 'close'
  | 'keyboard'
  | 'list'
  | 'link'
  | 'chevron-down'
  | 'chevron-up'
  | 'to-top'
  | 'to-bottom'
  | 'sort-asc'
  | 'sort-desc'
  | 'layers';

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
  -webkit-mask-image: url('./icons/help.png');
  mask-image: url('./icons/help.png');
}

.pr-icon--close {
  -webkit-mask-image: url('./icons/close.svg');
  mask-image: url('./icons/close.svg');
}

.pr-icon--keyboard {
  -webkit-mask-image: url('./icons/keyboard.svg');
  mask-image: url('./icons/keyboard.svg');
}

/* Source-tab glyphs: alpha masks sampled from docs/ui/source/v930-source/source-correlation.jpeg */
.pr-icon--list {
  -webkit-mask-image: url('./icons/list.png');
  mask-image: url('./icons/list.png');
}

.pr-icon--link {
  -webkit-mask-image: url('./icons/link.png');
  mask-image: url('./icons/link.png');
}

.pr-icon--chevron-down {
  -webkit-mask-image: url('./icons/chevron-down.png');
  mask-image: url('./icons/chevron-down.png');
}

.pr-icon--chevron-up {
  -webkit-mask-image: url('./icons/chevron-up.png');
  mask-image: url('./icons/chevron-up.png');
}

.pr-icon--to-top {
  -webkit-mask-image: url('./icons/to-top.png');
  mask-image: url('./icons/to-top.png');
}

.pr-icon--to-bottom {
  -webkit-mask-image: url('./icons/to-bottom.png');
  mask-image: url('./icons/to-bottom.png');
}

.pr-icon--sort-asc {
  -webkit-mask-image: url('./icons/sort-asc.png');
  mask-image: url('./icons/sort-asc.png');
}

.pr-icon--sort-desc {
  -webkit-mask-image: url('./icons/sort-desc.png');
  mask-image: url('./icons/sort-desc.png');
}

.pr-icon--layers {
  -webkit-mask-image: url('./icons/layers.png');
  mask-image: url('./icons/layers.png');
}
</style>
