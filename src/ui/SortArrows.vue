<template>
  <svg
    class="pr-sort-arrows"
    width="8"
    height="12"
    viewBox="0 0 8 12"
    aria-hidden="true"
  >
    <!-- Sketch draws a pair of hollow triangles, not a ◇ (v930/task-marquee:
         33x48 px at 4x, #999999, pixel-identical on every column). Bases are the
         two adjacent rows at the icon's midline. Every coord is half-pixel so a
         1px stroke lands on exactly one device row — on whole coords it straddles
         two rows at partial alpha and the bases wash out beside the diagonals. -->
    <path d="M4 0.5L7.5 5.5H0.5Z" />
    <path d="M4 11.5L7.5 6.5H0.5Z" />
  </svg>
</template>

<style scoped>
.pr-sort-arrows {
  flex: 0 0 auto;
  /* Seats the glyph on the label's baseline row rather than the line box top. */
  vertical-align: -2px;
}

.pr-sort-arrows path {
  fill: none;
  stroke: currentColor;
  stroke-width: 1;
  stroke-linejoin: round;
}
</style>
