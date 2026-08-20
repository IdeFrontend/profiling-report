<script setup lang="ts">
import { computed } from 'vue';
import { t } from '../../../i18n';
import {
  MAX_DEPENDENCY_DEPTH,
  normalizeDependencyDepth,
  type DependencyMode,
} from '../../../domain/types';
import type { DependencyNeighbors } from '../../../domain/dependencies';

const props = defineProps<{
  /** Name of the selected event — the `Current` column of the sketch. */
  currentName: string;
  neighbors: DependencyNeighbors;
  /** Shared with the swimlane curves — this panel is where both are edited. */
  mode: DependencyMode;
  /** `-1` walks the whole chain. */
  depth: number;
  locale?: string;
}>();

const emit = defineEmits<{
  'update:mode': [mode: DependencyMode];
  'update:depth': [depth: number];
}>();

/**
 * Sketch order: 仅展示前向依赖 · 展示前后向依赖 · 仅展示后向依赖. 前向 is what the task
 * waits on, so the left button keeps Incoming only — master's `predecessors` mode.
 */
const DIRECTIONS: {
  value: DependencyMode;
  key: 'depsUpstream' | 'depsBoth' | 'depsDownstream';
}[] = [
  { value: 'predecessors', key: 'depsUpstream' },
  { value: 'all', key: 'depsBoth' },
  { value: 'successors', key: 'depsDownstream' },
];

/**
 * Sketch glyphs: fan-in, four-way node, fan-out — drawn as a node graph, dots
 * joined by short links, not a hairline tree. Each direction is two path strings:
 * the link edges, and the nodes as zero-length segments that a round line cap
 * turns into dots (stroke-width 4.6 gives the sketch's radius of 2.3).
 * Coordinates come straight from the sketch, so keep them byte for byte.
 */
const GLYPHS: Record<DependencyMode, { edges: string; dots: string }> = {
  predecessors: {
    edges: 'M3.4 3.4 8 6.2M3.4 8 8 6.2M3.4 8 8 10.4M3.4 12.6 8 10.4M8 6.2 12.6 8M8 10.4 12.6 8',
    dots: 'M3.4 3.4h0M3.4 8h0M3.4 12.6h0M8 6.2h0M8 10.4h0M12.6 8h0',
  },
  all: {
    edges: 'M8 8 4 4M8 8 12 4M8 8 4 12M8 8 12 12',
    dots: 'M8 8h0M4 4h0M12 4h0M4 12h0M12 12h0',
  },
  successors: {
    edges:
      'M3.4 8 8 6.2M3.4 8 8 10.4M8 6.2 12.6 3.4M8 6.2 12.6 8M8 10.4 12.6 8M8 10.4 12.6 12.6',
    dots: 'M3.4 8h0M8 6.2h0M8 10.4h0M12.6 3.4h0M12.6 8h0M12.6 12.6h0',
  },
};

function onDepthInput(event: Event) {
  // A cleared number input reads as '' — normalizeDependencyDepth turns that (and
  // anything unparsable) into the shared default rather than letting NaN through.
  const raw = (event.target as HTMLInputElement).value.trim();
  emit('update:depth', normalizeDependencyDepth(raw === '' ? Number.NaN : Number(raw)));
}

/** Chip row geometry, mirrored in CSS — the connectors are drawn, not measured. */
const CHIP_HEIGHT = 22;
const CHIP_PITCH = 28;
const LINK_WIDTH = 32;

function rowCenter(index: number): number {
  return CHIP_HEIGHT / 2 + index * CHIP_PITCH;
}

/** Sketch connector: an S-curve from the current chip to a neighbour row. */
function curve(fromY: number, toY: number): string {
  const half = LINK_WIDTH / 2;
  return `M0 ${fromY}C${half} ${fromY} ${half} ${toY} ${LINK_WIDTH} ${toY}`;
}

/**
 * `neighborsOf` already blanks the suppressed side, so the five-column grid keeps
 * its shape and only loses chips.
 */
const incomingLinks = computed(() =>
  props.neighbors.incoming.map((node, i) => ({ id: node.id, d: curve(rowCenter(i), rowCenter(0)) })),
);

const outgoingLinks = computed(() =>
  props.neighbors.outgoing.map((node, i) => ({ id: node.id, d: curve(rowCenter(0), rowCenter(i)) })),
);

const linkHeight = computed(
  () =>
    Math.max(1, props.neighbors.incoming.length, props.neighbors.outgoing.length) * CHIP_PITCH,
);
</script>

<template>
  <section
    class="pr-detail-relevant"
    data-testid="detail-relevant"
    :aria-label="t('relevant', locale)"
  >
    <h3 class="pr-detail-relevant__title">
      {{ t('relevant', locale) }}
    </h3>

    <div class="pr-detail-relevant__toolbar">
      <div
        class="pr-detail-relevant__modes"
        role="group"
        :aria-label="t('relevant', locale)"
      >
        <button
          v-for="dir in DIRECTIONS"
          :key="dir.value"
          type="button"
          class="pr-detail-relevant__mode"
          :class="{ 'pr-detail-relevant__mode--active': mode === dir.value }"
          :data-testid="`detail-relevant-direction-${dir.value}`"
          :aria-pressed="mode === dir.value"
          :title="t(dir.key, locale)"
          @click="emit('update:mode', dir.value)"
        >
          <svg
            viewBox="0 0 16 16"
            width="14"
            height="14"
            aria-hidden="true"
          >
            <path
              :d="GLYPHS[dir.value].edges"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
            />
            <path
              :d="GLYPHS[dir.value].dots"
              fill="none"
              stroke="currentColor"
              stroke-width="4.6"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </div>

      <label class="pr-detail-relevant__level">
        <span>{{ t('connectionLevel', locale) }}:</span>
        <input
          class="pr-detail-relevant__level-input"
          data-testid="detail-relevant-level"
          type="number"
          step="1"
          min="-1"
          :max="MAX_DEPENDENCY_DEPTH"
          :value="depth"
          @change="onDepthInput"
        >
      </label>

      <span
        class="pr-detail-relevant__help"
        :title="t('connectionLevelHelp', locale)"
        aria-hidden="true"
      >?</span>
    </div>

    <p
      v-if="!neighbors.incoming.length && !neighbors.outgoing.length"
      class="pr-detail-relevant__empty"
      data-testid="detail-relevant-empty"
    >
      {{ t('noDependencies', locale) }}
    </p>

    <div
      v-else
      class="pr-detail-relevant__graph"
    >
      <div class="pr-detail-relevant__column">
        <div class="pr-detail-relevant__column-head">
          {{ t('incoming', locale) }}
          <span
            class="pr-detail-relevant__count"
            data-testid="detail-relevant-incoming-count"
          >{{ neighbors.incoming.length }}</span>
        </div>
        <span
          v-for="node in neighbors.incoming"
          :key="node.id"
          class="pr-detail-relevant__chip"
          :title="node.name"
        >{{ node.name }}</span>
      </div>

      <!--
        Both connector columns are the same markup; only the link array differs. The current
        column sits between them in the sketch, so it rides along with the incoming pass to
        keep the grid's column order.
      -->
      <template
        v-for="(links, side) in { incoming: incomingLinks, outgoing: outgoingLinks }"
        :key="side"
      >
        <div
          class="pr-detail-relevant__links"
          aria-hidden="true"
        >
          <div class="pr-detail-relevant__column-head" />
          <svg
            :width="LINK_WIDTH"
            :height="linkHeight"
            :viewBox="`0 0 ${LINK_WIDTH} ${linkHeight}`"
          >
            <path
              v-for="link in links"
              :key="link.id"
              :d="link.d"
              fill="none"
              stroke="currentColor"
              stroke-width="1.4"
            />
          </svg>
        </div>

        <div
          v-if="side === 'incoming'"
          class="pr-detail-relevant__column pr-detail-relevant__column--current"
        >
          <div class="pr-detail-relevant__column-head">
            {{ t('current', locale) }}
          </div>
          <span
            class="pr-detail-relevant__chip pr-detail-relevant__chip--current"
            :title="currentName"
          >{{ currentName }}</span>
        </div>
      </template>

      <div class="pr-detail-relevant__column pr-detail-relevant__column--out">
        <div class="pr-detail-relevant__column-head">
          {{ t('outgoing', locale) }}
          <span
            class="pr-detail-relevant__count"
            data-testid="detail-relevant-outgoing-count"
          >{{ neighbors.outgoing.length }}</span>
        </div>
        <span
          v-for="node in neighbors.outgoing"
          :key="node.id"
          class="pr-detail-relevant__chip"
          :title="node.name"
        >{{ node.name }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.pr-detail-relevant {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  min-width: 0;
  min-height: 0;
}

.pr-detail-relevant__title {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  color: #e0e0e0;
}

.pr-detail-relevant__toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.pr-detail-relevant__modes {
  display: flex;
  gap: 2px;
  padding: 3px;
  border-radius: 8px;
  background: #313131;
}

.pr-detail-relevant__mode {
  display: grid;
  place-items: center;
  width: 26px;
  height: 22px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #b0b0b0;
  cursor: pointer;
}

.pr-detail-relevant__mode--active {
  background: #464646;
  color: #f0f0f0;
}

.pr-detail-relevant__level {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #c0c0c0;
  font-size: 12px;
}

.pr-detail-relevant__level-input {
  width: 96px;
  padding: 5px 10px;
  border: 0;
  border-radius: 8px;
  background: #313131;
  color: #e6e6e6;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.pr-detail-relevant__help {
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border: 1px solid #6a6a6a;
  border-radius: 50%;
  color: #a0a0a0;
  font-size: 11px;
  cursor: help;
}

.pr-detail-relevant__empty {
  margin: 0;
  color: #888;
  font-size: 12px;
}

.pr-detail-relevant__graph {
  display: grid;
  /* Chip column, connector column, chip column, connector column, chip column. */
  grid-template-columns: minmax(0, 1fr) 32px minmax(0, 1fr) 32px minmax(0, 1fr);
  gap: 8px 0;
  overflow: auto;
  min-height: 0;
}

.pr-detail-relevant__column {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.pr-detail-relevant__column--out {
  text-align: right;
}

.pr-detail-relevant__links {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: #7a7a7a;
}

.pr-detail-relevant__column-head {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 18px;
  color: #a0a0a0;
  font-size: 12px;
}

.pr-detail-relevant__column--out .pr-detail-relevant__column-head {
  justify-content: flex-end;
}

.pr-detail-relevant__count {
  display: grid;
  place-items: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 9px;
  background: #3c3c3c;
  color: #cfcfcf;
  font-size: 11px;
}

.pr-detail-relevant__chip {
  /* Height and gap mirror CHIP_HEIGHT / CHIP_PITCH so the drawn connectors land on chips. */
  box-sizing: border-box;
  height: 22px;
  padding: 3px 8px;
  border-radius: 4px;
  line-height: 16px;
  text-align: center;
  background: #3c3c3c;
  color: #cfcfcf;
  font-size: 12px;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pr-detail-relevant__chip--current {
  background: #d5bcff;
  color: #241a33;
}

@media (max-width: 900px) {
  .pr-detail-relevant__graph {
    grid-template-columns: 1fr;
  }

  .pr-detail-relevant__links {
    display: none;
  }

  .pr-detail-relevant__column--out {
    text-align: left;
  }
}
</style>
