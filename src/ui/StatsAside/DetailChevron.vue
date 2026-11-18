<template>
  <!-- Right-pointing chevron (detail.svg) that turns a section heading into a
       clickable "open details" affordance. currentColor follows heading text. -->
  <svg
    viewBox="0 0 20 20"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M0.157611 1.04023L4.30761 5.19173C4.86526 5.74938 5.76218 5.76099 6.33396 5.22658L10.4948 1.06693C10.6022 0.959549 10.6623 0.822792 10.6752 0.682513C10.6705 0.529022 10.612 0.300217 10.4948 0.183067C10.2594 -0.0522995 9.88307 -0.0607046 9.63764 0.157839L5.78075 4.01321C5.54539 4.24858 5.16902 4.25699 4.92358 4.03844L1.06671 0.183067C0.822633 -0.0610224 0.426903 -0.0610224 0.182826 0.183067C0.0651423 0.300738 0.00420252 0.453669 0 0.607872C0.00481288 0.749181 0.0574366 0.927734 0.157611 1.04023Z"
      fill="currentColor"
      fill-rule="nonzero"
      transform="matrix(0,-1,1,0,7.19055,15.3387)"
    />
  </svg>
</template>

<style scoped>
svg {
  width: 12px;
  height: 12px;
  display: block;
}
</style>
