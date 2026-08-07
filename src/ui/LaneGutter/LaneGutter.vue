<script setup lang="ts">
import { computed, ref } from 'vue';

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

const props = defineProps<{
  groups: GutterGroup[];
  /** Group ids whose child lanes are hidden. */
  collapsedIds?: string[];
}>();

const emit = defineEmits<{
  scroll: [];
  'toggle-group': [groupId: string];
}>();

const root = ref<HTMLElement | null>(null);

const collapsed = computed(() => new Set(props.collapsedIds ?? []));

function isCollapsed(id: string): boolean {
  return collapsed.value.has(id);
}

function pctLabel(util: number): string {
  return `${Math.round(util * 100)}%`;
}

/** Sketch: muted red fill when util is low (&lt; 50%). */
function fillColor(lane: GutterLane): string {
  if (lane.utilization != null && lane.utilization < 0.5) return '#733234';
  return lane.color;
}

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
      <button
        type="button"
        class="pr-gutter__group"
        :data-testid="`gutter-group-${group.id}`"
        :aria-expanded="!isCollapsed(group.id)"
        @click="emit('toggle-group', group.id)"
      >
        <span
          class="pr-gutter__chevron"
          aria-hidden="true"
        >{{ isCollapsed(group.id) ? '▸' : '▾' }}</span>
        <span class="pr-gutter__group-name">{{ group.name }}</span>
      </button>
      <template v-if="!isCollapsed(group.id)">
        <div
          v-for="lane in group.lanes"
          :key="lane.id"
          class="pr-gutter__lane"
        >
          <span
            class="pr-gutter__name"
            :title="lane.name"
          >{{ lane.name }}</span>
          <span
            v-if="lane.utilization != null"
            class="pr-gutter__util"
            data-testid="lane-util"
          >
            <span
              class="pr-gutter__util-fill"
              :style="{
                width: `${Math.min(100, Math.max(0, lane.utilization * 100))}%`,
                background: fillColor(lane),
              }"
            />
            <span class="pr-gutter__util-pct">{{ pctLabel(lane.utilization) }}</span>
          </span>
          <span
            v-else
            class="pr-gutter__util pr-gutter__util--empty"
            aria-hidden="true"
          />
        </div>
      </template>
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
  padding: 0 6px 0 4px;
}

.pr-gutter::-webkit-scrollbar {
  display: none;
}

.pr-gutter__group {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 28px; /* keep in sync with LANE_GROUP_HEADER_HEIGHT */
  height: 28px;
  min-height: 28px;
  width: 100%;
  margin: 0;
  padding: 0 2px;
  border: 0;
  border-bottom: 1px solid #3a3a3a;
  background: transparent;
  font: inherit;
  font-weight: 600;
  color: #ddd;
  text-align: left;
  cursor: pointer;
}

.pr-gutter__group:hover {
  background: #333;
}

.pr-gutter__chevron {
  flex: 0 0 12px;
  width: 12px;
  font-size: 10px;
  line-height: 1;
  color: #a8a8a8;
  text-align: center;
}

.pr-gutter__group-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pr-gutter__lane {
  display: grid;
  /* VISUAL_SPEC: util column ~110px */
  grid-template-columns: minmax(0, 1fr) 110px;
  gap: 6px;
  align-items: center;
  flex: 0 0 22px; /* keep in sync with LANE_HEIGHT */
  height: 22px;
  min-height: 22px;
  padding-left: 14px; /* indent under chevron */
}

.pr-gutter__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Pill util bar — % inside, right-aligned (docs/specs/ui/components/VISUAL_SPEC.md) */
.pr-gutter__util {
  position: relative;
  display: block;
  box-sizing: border-box;
  height: 16px;
  width: 110px;
  background: #2a2a2a;
  border-radius: 8px;
  overflow: hidden;
}

.pr-gutter__util--empty {
  background: transparent;
}

.pr-gutter__util-fill {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  min-width: 0;
  border-radius: 8px 0 0 8px;
}

.pr-gutter__util-pct {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 6px;
  font-size: 10px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: #e8e8e8;
  text-shadow: 0 0 2px #000;
  line-height: 1;
  pointer-events: none;
  z-index: 1;
}
</style>
