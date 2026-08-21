<script setup lang="ts">
import { computed } from 'vue';
import type { MemoryTopologyModel } from '../../../domain/types';

const props = defineProps<{
  model: MemoryTopologyModel | null | undefined;
  locale?: string;
}>();

const show = computed(() => {
  const m = props.model;
  return Boolean(m && m.nodes.length > 0 && m.edges.some((e) => e.label != null && e.label !== ''));
});

function label(id: string): string | undefined {
  return props.model?.edges.find((e) => e.id === id)?.label;
}

/** Pillars + clusters leave GM↔L2 and L2↔cluster corridors for rotated GB/s labels. */
const GM = { x: 10, y: 28, w: 22, h: 464 };
const L2 = { x: 50, y: 28, w: 30, h: 464 };
const CL = { x: 128, w: 324, h: 148 };
const ROW = { aiv0: 28, aic: 186, aiv1: 344 };
const GM_L2_X = (GM.x + GM.w + L2.x) / 2;
const L2_W_X = L2.x + L2.w + 16;
const L2_R_X = CL.x - 16;

function clx(n: number): number {
  return CL.x + n;
}
function ry(row: keyof typeof ROW, n: number): number {
  return ROW[row] + n;
}
function rot(x: number, y: number): string {
  return `rotate(-90 ${x} ${y})`;
}
</script>

<template>
  <div
    v-if="show"
    class="pr-topo"
    data-testid="memory-topology-panel"
  >
    <svg
      class="pr-topo__svg"
      viewBox="0 0 460 520"
      role="img"
      aria-label="Memory topology"
    >
      <defs>
        <marker
          id="pr-topo-write"
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
        >
          <path
            d="M0,0 L6,3 L0,6 Z"
            fill="#4a8ec8"
          />
        </marker>
        <marker
          id="pr-topo-read"
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
        >
          <path
            d="M0,0 L6,3 L0,6 Z"
            fill="#e8c040"
          />
        </marker>
      </defs>

      <!-- GM pillar -->
      <rect
        :x="GM.x"
        :y="GM.y"
        :width="GM.w"
        :height="GM.h"
        rx="3"
        class="pr-topo__gm"
      />
      <text
        :x="GM.x + GM.w / 2"
        y="260"
        text-anchor="middle"
        :transform="rot(GM.x + GM.w / 2, 260)"
        class="pr-topo__pillar-label"
      >GM</text>

      <!-- L2 pillar -->
      <rect
        :x="L2.x"
        :y="L2.y"
        :width="L2.w"
        :height="L2.h"
        rx="3"
        class="pr-topo__l2"
      />
      <text
        :x="L2.x + L2.w / 2"
        y="248"
        text-anchor="middle"
        :transform="rot(L2.x + L2.w / 2, 248)"
        class="pr-topo__pillar-label"
      >L2 Cache</text>
      <text
        v-if="label('l2-hit')"
        :x="L2.x + L2.w / 2"
        y="486"
        text-anchor="middle"
        class="pr-topo__pct"
        data-testid="edge-l2-hit"
      >{{ label('l2-hit') }}</text>

      <rect
        :x="L2.x + 2"
        y="40"
        width="26"
        height="32"
        rx="2"
        class="pr-topo__muted"
      />
      <text
        :x="L2.x + L2.w / 2"
        y="59"
        text-anchor="middle"
        class="pr-topo__tiny"
      >XN_IMM</text>
      <rect
        :x="L2.x + 2"
        y="78"
        width="26"
        height="24"
        rx="2"
        class="pr-topo__muted"
      />
      <text
        :x="L2.x + L2.w / 2"
        y="93"
        text-anchor="middle"
        class="pr-topo__tiny"
      >Data Cache</text>

      <!-- GM ↔ L2 corridor. read = leaving GM (GM→L2); write = arriving at GM (L2→GM). -->
      <path
        :d="`M ${GM.x + GM.w} 176 L ${L2.x} 176`"
        class="pr-topo__arrow-read"
        marker-end="url(#pr-topo-read)"
      />
      <path
        :d="`M ${L2.x} 252 L ${GM.x + GM.w} 252`"
        class="pr-topo__arrow-write"
        marker-end="url(#pr-topo-write)"
      />
      <text
        v-if="label('gm-l2-read')"
        :x="GM_L2_X"
        y="176"
        text-anchor="middle"
        dominant-baseline="middle"
        :transform="rot(GM_L2_X, 176)"
        class="pr-topo__edge"
        data-testid="edge-gm-l2-read"
      >{{ label('gm-l2-read') }}</text>
      <text
        :x="GM_L2_X"
        y="252"
        text-anchor="middle"
        dominant-baseline="middle"
        :transform="rot(GM_L2_X, 252)"
        class="pr-topo__edge"
        data-testid="edge-gm-l2-write"
      >{{ label('gm-l2-write') ?? '' }}</text>

      <!-- AIV0 -->
      <rect
        :x="CL.x"
        :y="ROW.aiv0"
        :width="CL.w"
        :height="CL.h"
        rx="4"
        class="pr-topo__cluster"
      />
      <text
        :x="clx(8)"
        :y="ry('aiv0', 14)"
        class="pr-topo__cluster-title"
      >AIV0</text>
      <rect
        :x="clx(16)"
        :y="ry('aiv0', 24)"
        width="44"
        height="28"
        rx="2"
        class="pr-topo__compute"
      />
      <text
        :x="clx(38)"
        :y="ry('aiv0', 42)"
        text-anchor="middle"
        class="pr-topo__node"
      >Scalar</text>
      <rect
        :x="clx(68)"
        :y="ry('aiv0', 24)"
        width="124"
        height="108"
        rx="2"
        class="pr-topo__cache"
      />
      <text
        :x="clx(130)"
        :y="ry('aiv0', 80)"
        text-anchor="middle"
        class="pr-topo__node"
      >SIMT Data Cache / UB</text>
      <rect
        :x="clx(200)"
        :y="ry('aiv0', 30)"
        width="40"
        height="24"
        rx="2"
        class="pr-topo__cache"
      />
      <text
        :x="clx(220)"
        :y="ry('aiv0', 46)"
        text-anchor="middle"
        class="pr-topo__node"
      >SIMT</text>
      <rect
        :x="clx(200)"
        :y="ry('aiv0', 60)"
        width="40"
        height="24"
        rx="2"
        class="pr-topo__cache"
      />
      <text
        :x="clx(220)"
        :y="ry('aiv0', 76)"
        text-anchor="middle"
        class="pr-topo__node"
      >SIMD</text>
      <rect
        :x="clx(258)"
        :y="ry('aiv0', 24)"
        width="36"
        height="108"
        rx="2"
        class="pr-topo__compute"
      />
      <text
        :x="clx(276)"
        :y="ry('aiv0', 82)"
        text-anchor="middle"
        :transform="rot(clx(276), ry('aiv0', 82))"
        class="pr-topo__node"
      >VEC</text>
      <path
        :d="`M ${L2.x + L2.w} ${ry('aiv0', 72)} L ${CL.x} ${ry('aiv0', 72)}`"
        class="pr-topo__arrow-write"
        marker-end="url(#pr-topo-write)"
      />
      <path
        :d="`M ${CL.x} ${ry('aiv0', 100)} L ${L2.x + L2.w} ${ry('aiv0', 100)}`"
        class="pr-topo__arrow-read"
        marker-end="url(#pr-topo-read)"
      />
      <text
        v-if="label('l2-ub')"
        :x="L2_W_X"
        :y="ry('aiv0', 72)"
        text-anchor="middle"
        dominant-baseline="middle"
        :transform="rot(L2_W_X, ry('aiv0', 72))"
        class="pr-topo__edge"
        data-testid="edge-l2-ub"
      >{{ label('l2-ub') }}</text>
      <text
        v-if="label('ub-l2')"
        :x="L2_R_X"
        :y="ry('aiv0', 100)"
        text-anchor="middle"
        dominant-baseline="middle"
        :transform="rot(L2_R_X, ry('aiv0', 100))"
        class="pr-topo__edge"
        data-testid="edge-ub-l2"
      >{{ label('ub-l2') }}</text>
      <text
        v-if="label('vec-ub')"
        :x="clx(248)"
        :y="ry('aiv0', 142)"
        text-anchor="end"
        class="pr-topo__edge"
        data-testid="edge-vec-ub"
      >{{ label('vec-ub') }}</text>
      <text
        v-if="label('ub-vec')"
        :x="clx(108)"
        :y="ry('aiv0', 142)"
        text-anchor="middle"
        class="pr-topo__edge"
        data-testid="edge-ub-vec"
      >{{ label('ub-vec') }}</text>

      <!-- AIC -->
      <rect
        :x="CL.x"
        :y="ROW.aic"
        :width="CL.w"
        :height="CL.h"
        rx="4"
        class="pr-topo__cluster"
      />
      <text
        :x="clx(8)"
        :y="ry('aic', 14)"
        class="pr-topo__cluster-title"
      >AIC</text>
      <rect
        :x="clx(16)"
        :y="ry('aic', 28)"
        width="40"
        height="100"
        rx="2"
        class="pr-topo__cache"
      />
      <text
        :x="clx(36)"
        :y="ry('aic', 80)"
        text-anchor="middle"
        class="pr-topo__node"
      >L1</text>
      <rect
        :x="clx(68)"
        :y="ry('aic', 28)"
        width="28"
        height="22"
        rx="2"
        class="pr-topo__cache"
      />
      <text
        :x="clx(82)"
        :y="ry('aic', 43)"
        text-anchor="middle"
        class="pr-topo__tiny"
      >L0A</text>
      <rect
        :x="clx(68)"
        :y="ry('aic', 54)"
        width="28"
        height="22"
        rx="2"
        class="pr-topo__cache"
      />
      <text
        :x="clx(82)"
        :y="ry('aic', 69)"
        text-anchor="middle"
        class="pr-topo__tiny"
      >L0B</text>
      <rect
        :x="clx(68)"
        :y="ry('aic', 80)"
        width="28"
        height="22"
        rx="2"
        class="pr-topo__cache"
      />
      <text
        :x="clx(82)"
        :y="ry('aic', 95)"
        text-anchor="middle"
        class="pr-topo__tiny"
      >L0C</text>
      <rect
        :x="clx(108)"
        :y="ry('aic', 44)"
        width="56"
        height="56"
        rx="2"
        class="pr-topo__compute"
      />
      <text
        :x="clx(136)"
        :y="ry('aic', 76)"
        text-anchor="middle"
        class="pr-topo__node"
      >Cube</text>
      <rect
        :x="clx(176)"
        :y="ry('aic', 44)"
        width="44"
        height="28"
        rx="2"
        class="pr-topo__compute"
      />
      <text
        :x="clx(198)"
        :y="ry('aic', 62)"
        text-anchor="middle"
        class="pr-topo__node"
      >FixP</text>
      <rect
        :x="clx(176)"
        :y="ry('aic', 78)"
        width="44"
        height="28"
        rx="2"
        class="pr-topo__compute"
      />
      <text
        :x="clx(198)"
        :y="ry('aic', 96)"
        text-anchor="middle"
        class="pr-topo__node"
      >Scalar</text>
      <path
        :d="`M ${L2.x + L2.w} ${ry('aic', 72)} L ${CL.x} ${ry('aic', 72)}`"
        class="pr-topo__arrow-write"
        marker-end="url(#pr-topo-write)"
      />
      <path
        :d="`M ${CL.x} ${ry('aic', 100)} L ${L2.x + L2.w} ${ry('aic', 100)}`"
        class="pr-topo__arrow-read"
        marker-end="url(#pr-topo-read)"
      />
      <text
        v-if="label('l2-l1-read')"
        :x="L2_W_X"
        :y="ry('aic', 72)"
        text-anchor="middle"
        dominant-baseline="middle"
        :transform="rot(L2_W_X, ry('aic', 72))"
        class="pr-topo__edge"
        data-testid="edge-l2-l1-read"
      >{{ label('l2-l1-read') }}</text>
      <text
        v-if="label('l2-l1-write')"
        :x="L2_R_X"
        :y="ry('aic', 100)"
        text-anchor="middle"
        dominant-baseline="middle"
        :transform="rot(L2_R_X, ry('aic', 100))"
        class="pr-topo__edge"
        data-testid="edge-l2-l1-write"
      >{{ label('l2-l1-write') }}</text>
      <text
        v-if="label('l1-l0a')"
        :x="clx(70)"
        :y="ry('aic', 138)"
        text-anchor="middle"
        class="pr-topo__edge"
        data-testid="edge-l1-l0a"
      >{{ label('l1-l0a') }}</text>
      <text
        v-if="label('l1-l0b')"
        :x="clx(140)"
        :y="ry('aic', 138)"
        text-anchor="middle"
        class="pr-topo__edge"
        data-testid="edge-l1-l0b"
      >{{ label('l1-l0b') }}</text>
      <text
        v-if="label('l0a-cube')"
        :x="clx(210)"
        :y="ry('aic', 138)"
        text-anchor="middle"
        class="pr-topo__edge"
        data-testid="edge-l0a-cube"
      >{{ label('l0a-cube') }}</text>
      <text
        v-if="label('l0b-cube')"
        :x="clx(280)"
        :y="ry('aic', 138)"
        text-anchor="middle"
        class="pr-topo__edge"
        data-testid="edge-l0b-cube"
      >{{ label('l0b-cube') }}</text>
      <text
        v-if="label('l0c-cube')"
        :x="clx(70)"
        :y="ry('aic', 152)"
        text-anchor="middle"
        class="pr-topo__edge"
        data-testid="edge-l0c-cube"
      >{{ label('l0c-cube') }}</text>
      <text
        v-if="label('cube-l0c')"
        :x="clx(140)"
        :y="ry('aic', 152)"
        text-anchor="middle"
        class="pr-topo__edge"
        data-testid="edge-cube-l0c"
      >{{ label('cube-l0c') }}</text>
      <text
        v-if="label('l0c-l1')"
        :x="clx(210)"
        :y="ry('aic', 152)"
        text-anchor="middle"
        class="pr-topo__edge"
        data-testid="edge-l0c-l1"
      >{{ label('l0c-l1') }}</text>
      <text
        v-if="label('l0c-l2')"
        :x="clx(280)"
        :y="ry('aic', 152)"
        text-anchor="middle"
        class="pr-topo__edge"
        data-testid="edge-l0c-l2"
      >{{ label('l0c-l2') }}</text>

      <!-- AIV1 -->
      <rect
        :x="CL.x"
        :y="ROW.aiv1"
        :width="CL.w"
        :height="CL.h"
        rx="4"
        class="pr-topo__cluster"
      />
      <text
        :x="clx(8)"
        :y="ry('aiv1', 14)"
        class="pr-topo__cluster-title"
      >AIV1</text>
      <rect
        :x="clx(16)"
        :y="ry('aiv1', 24)"
        width="44"
        height="28"
        rx="2"
        class="pr-topo__compute"
      />
      <text
        :x="clx(38)"
        :y="ry('aiv1', 42)"
        text-anchor="middle"
        class="pr-topo__node"
      >Scalar</text>
      <rect
        :x="clx(68)"
        :y="ry('aiv1', 24)"
        width="124"
        height="108"
        rx="2"
        class="pr-topo__cache"
      />
      <text
        :x="clx(130)"
        :y="ry('aiv1', 80)"
        text-anchor="middle"
        class="pr-topo__node"
      >SIMT Data Cache / UB</text>
      <rect
        :x="clx(200)"
        :y="ry('aiv1', 30)"
        width="40"
        height="24"
        rx="2"
        class="pr-topo__cache"
      />
      <text
        :x="clx(220)"
        :y="ry('aiv1', 46)"
        text-anchor="middle"
        class="pr-topo__node"
      >SIMT</text>
      <rect
        :x="clx(200)"
        :y="ry('aiv1', 60)"
        width="40"
        height="24"
        rx="2"
        class="pr-topo__cache"
      />
      <text
        :x="clx(220)"
        :y="ry('aiv1', 76)"
        text-anchor="middle"
        class="pr-topo__node"
      >SIMD</text>
      <rect
        :x="clx(258)"
        :y="ry('aiv1', 24)"
        width="36"
        height="108"
        rx="2"
        class="pr-topo__compute"
      />
      <text
        :x="clx(276)"
        :y="ry('aiv1', 82)"
        text-anchor="middle"
        :transform="rot(clx(276), ry('aiv1', 82))"
        class="pr-topo__node"
      >VEC</text>
      <path
        :d="`M ${L2.x + L2.w} ${ry('aiv1', 72)} L ${CL.x} ${ry('aiv1', 72)}`"
        class="pr-topo__arrow-write"
        marker-end="url(#pr-topo-write)"
      />
      <path
        :d="`M ${CL.x} ${ry('aiv1', 100)} L ${L2.x + L2.w} ${ry('aiv1', 100)}`"
        class="pr-topo__arrow-read"
        marker-end="url(#pr-topo-read)"
      />
      <text
        v-if="label('l2-ub')"
        :x="L2_W_X"
        :y="ry('aiv1', 72)"
        text-anchor="middle"
        dominant-baseline="middle"
        :transform="rot(L2_W_X, ry('aiv1', 72))"
        class="pr-topo__edge"
      >{{ label('l2-ub') }}</text>
      <text
        v-if="label('ub-l2')"
        :x="L2_R_X"
        :y="ry('aiv1', 100)"
        text-anchor="middle"
        dominant-baseline="middle"
        :transform="rot(L2_R_X, ry('aiv1', 100))"
        class="pr-topo__edge"
      >{{ label('ub-l2') }}</text>
      <text
        v-if="label('vec-ub')"
        :x="clx(248)"
        :y="ry('aiv1', 142)"
        text-anchor="end"
        class="pr-topo__edge"
        data-testid="edge-vec-ub"
      >{{ label('vec-ub') }}</text>
      <text
        v-if="label('ub-vec')"
        :x="clx(108)"
        :y="ry('aiv1', 142)"
        text-anchor="middle"
        class="pr-topo__edge"
        data-testid="edge-ub-vec"
      >{{ label('ub-vec') }}</text>
    </svg>
  </div>
</template>

<style scoped>
.pr-topo {
  min-width: 0;
  background: #1a1a1a;
  border-radius: 4px;
  padding: 6px;
}

.pr-topo__svg {
  width: 100%;
  height: auto;
  display: block;
  overflow: visible;
}

.pr-topo__gm {
  fill: #3a3a3a;
}

.pr-topo__l2 {
  fill: #4a6a8a;
}

.pr-topo__muted {
  fill: #4a4a4a;
}

.pr-topo__cache {
  fill: #3d6a9a;
}

.pr-topo__compute {
  fill: #2e7a3a;
}

.pr-topo__cluster {
  fill: none;
  stroke: #6a6a6a;
  stroke-width: 1;
  stroke-dasharray: 4 3;
}

.pr-topo__pillar-label,
.pr-topo__cluster-title,
.pr-topo__node {
  fill: #f0f0f0;
  font-size: 9px;
}

.pr-topo__tiny {
  fill: #d8d8d8;
  font-size: 7px;
}

.pr-topo__edge,
.pr-topo__pct {
  fill: #e8c040;
  font-size: 8px;
}

.pr-topo__arrow-write {
  stroke: #4a8ec8;
  stroke-width: 1.5;
  fill: none;
}

.pr-topo__arrow-read {
  stroke: #e8c040;
  stroke-width: 1.5;
  fill: none;
}
</style>
