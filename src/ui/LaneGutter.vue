<script setup lang="ts">
import { ref } from 'vue';

export type GutterLane = {
  id: string;
  name: string;
  utilization?: number;
  color: string;
};

export type GutterGroup = {
  id: string;
  name: string;
  lanes: GutterLane[];
};

defineProps<{
  groups: GutterGroup[];
}>();

const emit = defineEmits<{
  scroll: [];
}>();

const root = ref<HTMLElement | null>(null);

defineExpose({ root });
</script>

<template>
  <div
    ref="root"
    class="pr-gutter"
    data-testid="lane-gutter"
    @scroll="emit('scroll')"
  >
    <template
      v-for="group in groups"
      :key="group.id"
    >
      <div class="pr-gutter__group">
        {{ group.name }}
      </div>
      <div
        v-for="lane in group.lanes"
        :key="lane.id"
        class="pr-gutter__lane"
      >
        <span
          class="pr-gutter__name"
          :title="lane.name"
        >{{ lane.name }}</span>
        <span class="pr-gutter__pct">
          <template v-if="lane.utilization != null">
            {{ Math.round(lane.utilization * 100) }}%
          </template>
        </span>
        <span
          v-if="lane.utilization != null"
          class="pr-gutter__util"
          data-testid="lane-util"
        >
          <span
            class="pr-gutter__util-bar"
            :style="{
              width: `${Math.min(100, lane.utilization * 100)}%`,
              background: lane.color,
            }"
          />
        </span>
        <span
          v-else
          class="pr-gutter__util pr-gutter__util--empty"
          aria-hidden="true"
        />
      </div>
    </template>
  </div>
</template>

<style scoped>
.pr-gutter {
  display: flex;
  flex-direction: column;
  font-size: 11px;
  color: #c8c8c8;
  overflow: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  min-height: 0;
  background: #2a2a2a;
  border-right: 1px solid #3a3a3a;
  padding: 0 6px 0 8px;
}

.pr-gutter::-webkit-scrollbar {
  display: none;
}

.pr-gutter__group {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  flex: 0 0 28px; /* keep in sync with LANE_GROUP_HEADER_HEIGHT */
  height: 28px;
  min-height: 28px;
  padding: 0;
  margin: 0;
  font-weight: 600;
  color: #ddd;
  border-bottom: 1px solid #3a3a3a;
}

.pr-gutter__lane {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 34px 40px;
  gap: 4px;
  align-items: center;
  flex: 0 0 22px; /* keep in sync with LANE_HEIGHT */
  height: 22px;
  min-height: 22px;
}

.pr-gutter__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pr-gutter__pct {
  text-align: right;
  font-variant-numeric: tabular-nums;
  opacity: 0.85;
  font-size: 10px;
  min-height: 1em;
}

.pr-gutter__util {
  display: block;
  height: 6px;
  background: #1a1a1a;
  border-radius: 1px;
  overflow: hidden;
}

.pr-gutter__util--empty {
  background: transparent;
}

.pr-gutter__util-bar {
  display: block;
  height: 100%;
  border-radius: 1px;
  min-width: 0;
}
</style>
