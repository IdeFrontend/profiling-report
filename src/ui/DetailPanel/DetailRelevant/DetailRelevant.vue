<script setup lang="ts">
import { computed } from 'vue';
import { t } from '../../../i18n';
import { type DependencyMode } from '../../../domain/types';
import type { DependencyNeighbors } from '../../../domain/dependencies';

const props = defineProps<{
  /** Name of the selected event — the `Current` column of the sketch. */
  currentName: string;
  neighbors: DependencyNeighbors;
  /** Which sides to show. Depth belongs to 显示控制 and drives the swimlane only. */
  mode: DependencyMode;
  locale?: string;
}>();

const emit = defineEmits<{
  'update:mode': [mode: DependencyMode];
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
 * turns into dots.
 *
 * The viewBox is 1:1 with the rendered px box, so these are the sketch's own
 * measurements (its 4x export, divided by four): dots on a 5px grid, 3.5px across,
 * leaving a 1.5px gap between neighbours. The previous pass packed the same dots
 * onto a 4.6px pitch at 4.6px across — wider than their spacing — so every tree
 * fused into a solid triangle. Keep DOT_SIZE below the 5px pitch.
 */
const DOT_SIZE = 3.5;
const EDGE_WIDTH = 1;
/** Sketch draws the links at half the dot's strength — measured alpha 0.500 on both states. */
const EDGE_OPACITY = 0.5;

const GLYPHS: Record<DependencyMode, { edges: string; dots: string }> = {
  predecessors: {
    edges: 'M2 2 7 4.5M2 7 7 9.5M2 12 7 9.5M7 4.5 12 7M7 9.5 12 7',
    dots: 'M2 2h0M2 7h0M2 12h0M7 4.5h0M7 9.5h0M12 7h0',
  },
  all: {
    edges: 'M7 7 3 3M7 7 11 3M7 7 3 11M7 7 11 11',
    dots: 'M7 7h0M3 3h0M11 3h0M3 11h0M11 11h0',
  },
  successors: {
    edges: 'M2 7 7 4.5M2 7 7 9.5M7 4.5 12 2M7 9.5 12 7M7 9.5 12 12',
    dots: 'M2 7h0M7 4.5h0M7 9.5h0M12 2h0M12 7h0M12 12h0',
  },
};

/** Chip row geometry, mirrored in CSS — the connectors are drawn, not measured. */
const CHIP_HEIGHT = 18;
const CHIP_PITCH = 26;
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
 * `neighborsOf` already blanks the suppressed side, so the grid keeps its shape and
 * only loses chips.
 *
 * Each side's connector svg spans its OWN chip column: sizing both off the longer
 * side stretched the shorter one's viewBox (34 rows drawn across 55 rows of height),
 * which fanned its curves away from the chips they point at.
 */
const incomingLinks = computed(() =>
  props.neighbors.incoming.map((node, i) => ({ id: node.id, d: curve(rowCenter(i), rowCenter(0)) })),
);

const outgoingLinks = computed(() =>
  props.neighbors.outgoing.map((node, i) => ({ id: node.id, d: curve(rowCenter(0), rowCenter(i)) })),
);

const incomingHeight = computed(() => sideHeight(props.neighbors.incoming.length));
const outgoingHeight = computed(() => sideHeight(props.neighbors.outgoing.length));

/** Height of a chip column: n rows on CHIP_PITCH, minus the gap the last row doesn't use. */
function sideHeight(count: number): number {
  return Math.max(1, count) * CHIP_PITCH - (CHIP_PITCH - CHIP_HEIGHT);
}
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
            viewBox="0 0 14 14"
            width="14"
            height="14"
            aria-hidden="true"
          >
            <path
              :d="GLYPHS[dir.value].edges"
              fill="none"
              stroke="currentColor"
              :stroke-width="EDGE_WIDTH"
              :stroke-opacity="EDGE_OPACITY"
            />
            <path
              :d="GLYPHS[dir.value].dots"
              fill="none"
              stroke="currentColor"
              :stroke-width="DOT_SIZE"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </div>
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
      <!--
        Three tracks, not five: each side is [chips + connector] and both sides are 1fr,
        so the Current pill sits at the dock's centre no matter how wide either side's
        chips are — or whether a direction filter emptied one. Inside a side the chip
        column is content-sized and the connector absorbs the slack, so a curve always
        reaches the chip it points at.
      -->
      <div class="pr-detail-relevant__side">
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

        <div
          class="pr-detail-relevant__links"
          aria-hidden="true"
        >
          <div class="pr-detail-relevant__column-head" />
          <svg
            :height="incomingHeight"
            :viewBox="`0 0 ${LINK_WIDTH} ${incomingHeight}`"
            preserveAspectRatio="none"
          >
            <path
              v-for="link in incomingLinks"
              :key="link.id"
              :d="link.d"
              fill="none"
              stroke="currentColor"
              stroke-width="1.4"
              vector-effect="non-scaling-stroke"
            />
          </svg>
        </div>
      </div>

      <div class="pr-detail-relevant__column pr-detail-relevant__column--current">
        <div class="pr-detail-relevant__column-head">
          {{ t('current', locale) }}
        </div>
        <span
          class="pr-detail-relevant__chip pr-detail-relevant__chip--current"
          :title="currentName"
        >{{ currentName }}</span>
      </div>

      <!-- Same markup as the incoming side; CSS reverses it so the chips sit outermost. -->
      <div class="pr-detail-relevant__side pr-detail-relevant__side--out">
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

        <div
          class="pr-detail-relevant__links"
          aria-hidden="true"
        >
          <div class="pr-detail-relevant__column-head" />
          <svg
            :height="outgoingHeight"
            :viewBox="`0 0 ${LINK_WIDTH} ${outgoingHeight}`"
            preserveAspectRatio="none"
          >
            <path
              v-for="link in outgoingLinks"
              :key="link.id"
              :d="link.d"
              fill="none"
              stroke="currentColor"
              stroke-width="1.4"
              vector-effect="non-scaling-stroke"
            />
          </svg>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.pr-detail-relevant {
  /* CHIP_PITCH - CHIP_HEIGHT. The chip columns and the connector column both read it,
     so an svg row can never drift off its chip row again. */
  --pr-chip-gap: 8px;
  /* Widest a chip pill gets before it truncates. The grid tracks read it too, so a
     long name cannot stretch its column and leave the connector short of the chip. */
  --pr-chip-max: 150px;
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
  /* Sketch's 4x export at the pill's centre row (away from the corner radius):
     80px pill around three 24px buttons, leaving 2px padding + 2px gaps. */
  gap: 2px;
  padding: 2px;
  border-radius: 6px;
  background: #313131;
}

.pr-detail-relevant__mode {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #b3b3b3;
  cursor: pointer;
}

.pr-detail-relevant__mode--active {
  background: #464646;
  color: #e6e6e6;
}




.pr-detail-relevant__empty {
  margin: 0;
  color: #888;
  font-size: 12px;
}

.pr-detail-relevant__graph {
  display: grid;
  /* Equal side tracks keep Current centred; the pill itself is content-sized. */
  grid-template-columns: 1fr fit-content(var(--pr-chip-max)) 1fr;
  gap: 8px 0;
  overflow: auto;
  min-height: 0;
}

.pr-detail-relevant__side {
  display: grid;
  /* Chips hug their content, the connector takes the rest of the side. */
  grid-template-columns: fit-content(var(--pr-chip-max)) minmax(32px, 1fr);
  min-width: 0;
}

.pr-detail-relevant__side--out {
  grid-template-columns: minmax(32px, 1fr) fit-content(var(--pr-chip-max));
}

/* Mirrored side: chips outermost, connector against the Current pill. */
.pr-detail-relevant__side--out .pr-detail-relevant__column {
  order: 2;
}

.pr-detail-relevant__column {
  display: flex;
  flex-direction: column;
  /* Chips fill their track rather than hugging their own text. The track is already
     content-sized — fit-content(--pr-chip-max) — so this makes the column uniform AND
     puts every chip's edge exactly where the connector starts. Content-sized chips left
     a dead gap between the shorter names and their curves. */
  align-items: stretch;
  gap: var(--pr-chip-gap);
  min-width: 0;
}

/* The Current pill is one chip in its own track, so it hugs its text. */
.pr-detail-relevant__column--current {
  align-items: center;
}

.pr-detail-relevant__column--out {
  text-align: right;
}

.pr-detail-relevant__links {
  display: flex;
  flex-direction: column;
  gap: var(--pr-chip-gap);
  color: #7a7a7a;
}

.pr-detail-relevant__links svg {
  /* Stretches across whatever gap the chip columns leave, so a curve always joins a
     chip to the current pill; non-scaling-stroke keeps it 1.4px through the stretch. */
  width: 100%;
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
  height: 18px;
  /* Vertical padding is 0 and the line box is the full height: the text centres itself
     through half-leading, whatever the platform font's natural line box turns out to be.
     A 1px pad against a 16px line left ~1px of slack, and Segoe UI's taller metrics ate
     it — descenders and parentheses clipped on Windows but not on Linux. */
  padding: 0 8px;
  border-radius: 4px;
  line-height: 18px;
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
