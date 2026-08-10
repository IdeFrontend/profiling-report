<script setup lang="ts">
import type { HardwareDetailsModel } from '../../../domain/types';

defineProps<{
  model: HardwareDetailsModel;
  locale?: string;
}>();
</script>

<template>
  <div
    v-if="model.sections.length > 0"
    class="pr-hw"
    data-testid="hardware-details"
  >
    <section
      v-for="sec in model.sections"
      :key="sec.id"
      class="pr-hw__section"
    >
      <h5 class="pr-hw__title">
        {{ sec.title }}
      </h5>
      <ul class="pr-hw__list">
        <li
          v-for="f in sec.fields"
          :key="f.key"
          class="pr-hw__row"
        >
          <span class="pr-hw__key">{{ f.key }}</span>
          <span class="pr-hw__val">{{ f.value }}</span>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.pr-hw {
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: auto;
  min-height: 0;
}

.pr-hw__title {
  margin: 0 0 6px;
  font-size: 12px;
  font-weight: 600;
  color: #d0d8e0;
}

.pr-hw__list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.pr-hw__row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
  padding: 3px 0;
  border-bottom: 1px solid #3a424a;
}

.pr-hw__key {
  color: #a0a8b0;
}

.pr-hw__val {
  color: #e8eef4;
  text-align: right;
}
</style>
