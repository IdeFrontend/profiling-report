<script setup lang="ts">
/** P2 stub — Relevant dependency graph column of the raised 「详情」 dock. */
</script>

<template>
  <section
    class="pr-detail-relevant"
    data-testid="detail-relevant"
    aria-label="Relevant"
  >
    <h3 class="pr-detail-relevant__title">Relevant</h3>
    <p class="pr-detail-relevant__placeholder">—</p>
  </section>
</template>

<style scoped>
.pr-detail-relevant {
  padding: 8px 12px;
  border-left: 1px solid #3a3a3a;
  min-width: 0;
  color: #888;
}

.pr-detail-relevant__title {
  margin: 0 0 6px;
  font-size: 12px;
  font-weight: 600;
  color: #c8c8c8;
}

.pr-detail-relevant__placeholder {
  margin: 0;
  font-size: 11px;
}
</style>
