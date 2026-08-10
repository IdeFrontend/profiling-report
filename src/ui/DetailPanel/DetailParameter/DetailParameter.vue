<script setup lang="ts">
/** P2 stub — Parameter / Code column of the raised 「详情」 dock. */
</script>

<template>
  <section
    class="pr-detail-parameter"
    data-testid="detail-parameter"
    aria-label="Parameter"
  >
    <h3 class="pr-detail-parameter__title">Parameter</h3>
    <p class="pr-detail-parameter__placeholder">—</p>
  </section>
</template>

<style scoped>
.pr-detail-parameter {
  padding: 8px 12px;
  border-left: 1px solid #3a3a3a;
  min-width: 0;
  color: #888;
}

.pr-detail-parameter__title {
  margin: 0 0 6px;
  font-size: 12px;
  font-weight: 600;
  color: #c8c8c8;
}

.pr-detail-parameter__placeholder {
  margin: 0;
  font-size: 11px;
}
</style>
