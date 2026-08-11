<script setup lang="ts">
import { computed, ref } from 'vue';
import LaneGutterNode from './LaneGutterNode.vue';
import type { GutterGroup, GutterLane } from './gutterTypes';

export type { GutterGroup, GutterLane };

const props = defineProps<{
  groups: GutterGroup[];
  /** Card or nested folder ids whose descendants are hidden. */
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
        <LaneGutterNode
          v-for="lane in group.lanes"
          :key="lane.id"
          :lane="lane"
          :depth="0"
          :collapsed-ids="collapsedIds"
          @toggle="(id) => emit('toggle-group', id)"
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
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 28px;
  height: 28px;
  min-height: 28px;
  width: 100%;
  margin: 0;
  padding: 0 8px 0 8px;
  border: 0;
  border-bottom: 1px solid #3a3a3a;
  background: #262626;
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
</style>
