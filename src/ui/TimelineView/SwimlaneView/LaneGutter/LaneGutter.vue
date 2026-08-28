<script setup lang="ts">
import { computed, ref } from 'vue';
import LaneGutterNode from './LaneGutterNode.vue';
import type { GutterGroup, GutterLane } from './gutterTypes';

export type { GutterGroup, GutterLane };

const props = defineProps<{
  groups: GutterGroup[];
  /** Card or nested folder ids whose descendants are hidden. */
  collapsedIds?: string[];
  /** Leaf lane ids currently pinned (filled pushpin). */
  pinnedLaneIds?: string[];
  /** Leaf under canvas hover — shows pin + row highlight. */
  hoveredLaneId?: string | null;
}>();

const emit = defineEmits<{
  scroll: [];
  'toggle-group': [groupId: string];
  'pin-lane': [laneId: string];
  'unpin-lane': [laneId: string];
}>();

const root = ref<HTMLElement | null>(null);

const collapsed = computed(() => new Set(props.collapsedIds ?? []));

function isCollapsed(id: string): boolean {
  return collapsed.value.has(id);
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
      <!-- Card chrome (label/click) lives on SwimlaneView full-width strips. -->
      <div
        class="pr-gutter__group"
        :data-testid="`gutter-group-${group.id}`"
        aria-hidden="true"
      />
      <template v-if="!isCollapsed(group.id)">
        <LaneGutterNode
          v-for="lane in group.lanes"
          :key="lane.id"
          :lane="lane"
          :depth="0"
          :collapsed-ids="collapsedIds"
          :pinned-lane-ids="pinnedLaneIds"
          :hovered-lane-id="hoveredLaneId"
          @toggle="(id) => emit('toggle-group', id)"
          @pin-lane="(id) => emit('pin-lane', id)"
          @unpin-lane="(id) => emit('unpin-lane', id)"
        />
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
  background: #1f1f1f;
  border-right: 1px solid #3a3a3a;
  padding: 0;
}

.pr-gutter::-webkit-scrollbar {
  display: none;
}

.pr-gutter__group {
  box-sizing: border-box;
  flex: 0 0 28px;
  height: 28px;
  min-height: 28px;
  width: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  border-bottom: 1px solid #3a3a3a;
  background: transparent;
  pointer-events: none;
}
</style>
