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
          :class="isCollapsed(group.id) ? 'pr-gutter__chevron--right' : 'pr-gutter__chevron--down'"
          aria-hidden="true"
        />
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
  color: #b0b0b0;
  overflow: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  min-height: 0;
  background: #262626;
  border-right: 1px solid #3a3a3a;
  padding: 0 8px 0 0;
}

.pr-gutter::-webkit-scrollbar {
  display: none;
}

.pr-gutter__group {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 28px; /* keep in sync with LANE_GROUP_HEADER_HEIGHT */
  height: 28px;
  min-height: 28px;
  width: 100%;
  margin: 0;
  padding: 0 8px 0 8px;
  border: 0;
  border-bottom: 1px solid #3a3a3a;
  background: transparent;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  color: #e8e8e8;
  text-align: left;
  cursor: pointer;
}

.pr-gutter__group:hover {
  background: #2f2f2f;
}

/*
 * Open-angle chevrons (stroke), not filled ▾/▸ glyphs.
 * Size ~8×5 down / 5×8 right — matches sketch pixel chevrons.
 */
.pr-gutter__chevron {
  box-sizing: border-box;
  flex: 0 0 10px;
  width: 10px;
  height: 10px;
  display: inline-block;
  position: relative;
  color: #a8a8a8;
}

.pr-gutter__chevron::before {
  content: '';
  position: absolute;
  box-sizing: border-box;
  border-style: solid;
  border-color: currentColor;
  border-width: 0 1.2px 1.2px 0;
  width: 5px;
  height: 5px;
}

.pr-gutter__chevron--down::before {
  top: 1px;
  left: 2px;
  transform: rotate(45deg);
}

.pr-gutter__chevron--right::before {
  top: 2px;
  left: 1px;
  transform: rotate(-45deg);
}

.pr-gutter__group-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pr-gutter__lane {
  display: grid;
  /* label aligns under group title (pad 8 + chev 10 + gap 6 = 24) */
  grid-template-columns: minmax(0, 1fr) 110px;
  gap: 6px;
  align-items: center;
  flex: 0 0 22px; /* keep in sync with LANE_HEIGHT */
  height: 22px;
  min-height: 22px;
  padding: 0 8px 0 24px;
  box-sizing: border-box;
  border-bottom: 1px solid #333;
}

.pr-gutter__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  font-weight: 400;
  color: #b0b0b0;
}

/* Util bar — % inside, right-aligned (docs/specs/ui/components/VISUAL_SPEC.md) */
.pr-gutter__util {
  position: relative;
  display: block;
  box-sizing: border-box;
  height: 16px;
  width: 110px;
  /* Unfilled: gray diagonal hatch (not solid black). */
  background: repeating-linear-gradient(
    -45deg,
    #3a3a3a 0,
    #3a3a3a 1px,
    #2a2a2a 1px,
    #2a2a2a 4px
  );
  border-radius: 2px;
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
  border-radius: 0;
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
  color: #b0b0b0; /* match lane title */
  line-height: 1;
  pointer-events: none;
  z-index: 1;
}
</style>
