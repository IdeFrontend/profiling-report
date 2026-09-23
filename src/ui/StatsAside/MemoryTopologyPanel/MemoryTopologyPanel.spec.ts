import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import MemoryTopologyPanel, {
  DEFAULT_MAX_W,
  PLATE_MAX_W,
  PLATE_SLOTS,
  SLOT_MAX_W,
  SLOTS,
  ZOOM_STEPS,
  fitFontSize,
} from './MemoryTopologyPanel.vue';
import { TOPOLOGY_PLATE_NODE_IDS, hasDrawableTopology } from '../../../adapters/memoryTopology';
import type { TopologyPlateNodeId, TopologySlotEdgeId } from '../../../adapters/memoryTopology';

const model = {
  nodes: [
    { id: 'gm', label: 'GM' },
    { id: 'l2', label: 'L2 Cache' },
    { id: 'cube', label: 'Cube' },
    { id: 'ub', label: 'UB' },
  ],
  edges: [
    { id: 'gm-l2-read', from: 'gm', to: 'l2', label: '1.56 GB/s' },
    { id: 'l2-ub', from: 'l2', to: 'ub', label: '0.00 GB/s' },
    { id: 'vec-ub', from: 'vec', to: 'ub', label: '0.10 GB/s' },
    { id: 'ub-vec', from: 'ub', to: 'vec', label: '0.20 GB/s' },
    { id: 'gm-l2-write', from: 'gm', to: 'l2' },
    { id: 'l1-l0a', from: 'l1', to: 'l0a', label: '1.00 GB/s' },
    { id: 'l1-l0b', from: 'l1', to: 'l0b', label: '2.00 GB/s' },
    { id: 'l0a-cube', from: 'l0a', to: 'cube', label: '3.00 GB/s' },
    { id: 'l0b-cube', from: 'l0b', to: 'cube', label: '4.00 GB/s' },
    { id: 'l0c-cube', from: 'l0c', to: 'cube', label: '5.00 GB/s' },
    { id: 'cube-l0c', from: 'cube', to: 'l0c', label: '6.00 GB/s' },
    { id: 'l0c-l1', from: 'l0c', to: 'l1', label: '7 KB' },
    { id: 'l0c-l2', from: 'l0c', to: 'l2', label: '8 KB' },
  ],
};

/** Chrome geometry (448×423 units): GM x16–56, L2 x94–134, cluster rows x188–432. */
const CHROME = { gmRight: 56, l2Left: 94, l2Right: 134, clusterLeft: 188 };

/** Two panels in *one* app: the stacked aside and the fullscreen overlay render at the same time,
 *  which a pair of `mount()` calls cannot reproduce (each is its own app). */
const TwoPanels = defineComponent({
  components: { MemoryTopologyPanel },
  props: { model: { type: Object, required: true } },
  template: `<div>
    <MemoryTopologyPanel :model="model" />
    <MemoryTopologyPanel :model="model" />
  </div>`,
});

/** A gear for the whole file: the bar tweens a ladder step (PR-MEMTOP-019) with `animateProgress`,
 *  which takes each frame's time from the callback's own `now` and only the start of the step from
 *  `performance.now()` — so handing the callback a stamp past the end of the step lands the step in
 *  the click itself. Every test below that clicks a zoom control is then the same test it was
 *  before the tween existed (`await trigger('click')` still carries the post-flush placement of
 *  PR-MEMTOP-018); the tween's own curve is covered by `animateViewWindow.spec.ts`, and the one test
 *  that needs to see a step *in flight* re-stubs this with a queue of its own. */
beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(performance.now() + 10_000);
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('MemoryTopologyPanel', () => {
  it('PR-MEMTOP-001: renders the chrome asset and the L2 node anchor', () => {
    const wrapper = mount(MemoryTopologyPanel, { props: { model } });
    expect(wrapper.find('[data-testid="memory-topology-panel"]').exists()).toBe(true);
    const chrome = wrapper.get('image');
    expect(chrome.attributes('href')).toContain('memory-topology.svg');
    expect(chrome.attributes('width')).toBe('448');
    expect(chrome.attributes('height')).toBe('423');
    expect(wrapper.find('[data-testid="node-l2"]').exists()).toBe(true);
    expect(wrapper.get('svg').attributes('viewBox')).toBe('0 0 448 423');
  });

  it('PR-MEMTOP-001b: chrome has no baked sample GB/s glyphs (overlay-only values)', async () => {
    // The simplified export ships outlined sample values in amber (`rgb(249,183,102)`). Those must
    // be stripped in-repo — otherwise panel overlays double-print on top of them (gelu.npu-rep).
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const { dirname, join } = await import('node:path');
    const dir = dirname(fileURLToPath(import.meta.url));
    const svg = readFileSync(join(dir, 'memory-topology.svg'), 'utf8');
    expect(svg).not.toContain('rgb(249,183,102)');
    expect(svg.toLowerCase()).not.toContain('<text');

    // Under-word util `%` samples were white path fills (same strip pass). Their centres must stay
    // empty so overlays own the plate — not a leftover white `0.00%` under Scalar/Vec/Cube/L2.
    const STRIPPED_UTIL: ReadonlyArray<readonly [string, number, number]> = [
      ['L2 peak', 114.1, 218.3],
      ['Cube util', 338.1, 95.3],
      ['AIV Scalar util', 282.2, 321.0],
      ['Vec util', 372.1, 367.8],
    ];
    const whiteCentres: Array<{ cx: number; cy: number }> = [];
    for (const m of svg.matchAll(/<path\b([\s\S]*?)\/>/g)) {
      const attrs = m[1] ?? '';
      if (!attrs.includes('fill="rgb(255,255,255)"')) continue;
      const d = /\bd="([^"]*)"/.exec(attrs)?.[1];
      if (!d) continue;
      const nums = [...d.matchAll(/[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/g)].map((x) => Number(x[0]));
      const xs = nums.filter((_, i) => i % 2 === 0);
      const ys = nums.filter((_, i) => i % 2 === 1);
      if (xs.length === 0 || ys.length === 0) continue;
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      if (maxY - minY > 10) continue;
      whiteCentres.push({ cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 });
    }
    for (const [name, x, y] of STRIPPED_UTIL) {
      const hit = whiteCentres.some((c) => Math.hypot(c.cx - x, c.cy - y) < 4);
      expect(hit, `leftover white util glyph near ${name} (${x}, ${y})`).toBe(false);
    }
  });

  it('PR-MEMTOP-001c: chrome keeps static box labels after the sample strip', async () => {
    // Over-stripping white sample glyphs also deleted DCache/ICache/SS/L0*/FixPipe outlined
    // labels, leaving gray/blue/orange boxes empty. Required label centres (chrome units):
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const { dirname, join } = await import('node:path');
    const dir = dirname(fileURLToPath(import.meta.url));
    const svg = readFileSync(join(dir, 'memory-topology.svg'), 'utf8');

    const REQUIRED: ReadonlyArray<readonly [string, number, number]> = [
      ['DCache (AIC)', 215.2, 170.0],
      ['ICache (AIC)', 213.2, 186.0],
      ['DCache (AIV)', 215.2, 242.0],
      ['ICache (AIV)', 213.2, 258.0],
      ['SS', 309.9, 208.8],
      ['L0A', 272.6, 59.4],
      ['L0B', 272.5, 84.2],
      ['BT', 272.6, 110.9],
      ['FP', 272.6, 136.7],
      ['FixPipe (L0C)', 404.1, 137.4],
      ['FixPipe (L1→FP)', 237.9, 137.4],
      ['MTE_1 L1→L0A', 237.6, 59.4],
      ['MTE_1 L1→L0B', 237.6, 84.4],
      ['MTE_1 L1→BT', 237.6, 112.4],
      ['MTE_2 L2→L1', 158.4, 98.4],
      ['MTE_3 AIV mid', 341.8, 272.4],
      ['MTE_2 L2→UB', 217.9, 321.4],
      ['MTE_3 UB→L2', 217.8, 336.4],
      ['MTE_2 bottom', 217.9, 378.4],
    ];

    // Figma paths are `id="" d="…" fill="…" />` — `\bd=` avoids matching the trailing
    // `d=""` of `id=""`, and `[\s\S]*?` spans the multiline attribute block.
    const whiteCentres: Array<{ cx: number; cy: number }> = [];
    for (const m of svg.matchAll(/<path\b([\s\S]*?)\/>/g)) {
      const attrs = m[1] ?? '';
      if (!attrs.includes('fill="rgb(255,255,255)"')) continue;
      const d = /\bd="([^"]*)"/.exec(attrs)?.[1];
      if (!d) continue;
      const nums = [...d.matchAll(/[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/g)].map((x) => Number(x[0]));
      const xs = nums.filter((_, i) => i % 2 === 0);
      const ys = nums.filter((_, i) => i % 2 === 1);
      if (xs.length === 0 || ys.length === 0) continue;
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      if (maxY - minY > 10) continue;
      whiteCentres.push({ cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 });
    }

    for (const [name, x, y] of REQUIRED) {
      const hit = whiteCentres.some((c) => Math.abs(c.cx - x) <= 3 && Math.abs(c.cy - y) <= 3);
      expect(hit, `missing static label path for ${name} near (${x}, ${y})`).toBe(true);
    }
  });

  it('PR-MEMTOP-001d: SLOTS never sit on orange MTE/FixPipe chip centres', async () => {
    // Remasuring onto white-under-orange chip rects put GB/s overlays on MTE labels.
    // Chip centres come from the chrome's `#f69e39` / `rgb(246,158,57)` rects — not a hardcoded list.
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const { dirname, join } = await import('node:path');
    const dir = dirname(fileURLToPath(import.meta.url));
    const svg = readFileSync(join(dir, 'memory-topology.svg'), 'utf8');
    const chips: Array<{ cx: number; cy: number }> = [];
    for (const m of svg.matchAll(/<rect\b([\s\S]*?)\/>/g)) {
      const attrs = m[1] ?? '';
      if (!/rgb\(246,\s*158,\s*57\)|#f69e39/i.test(attrs)) continue;
      const x = Number(/\bx="([^"]+)"/.exec(attrs)?.[1]);
      const y = Number(/\by="([^"]+)"/.exec(attrs)?.[1]);
      const w = Number(/\bwidth="([^"]+)"/.exec(attrs)?.[1]);
      const h = Number(/\bheight="([^"]+)"/.exec(attrs)?.[1]);
      if (![x, y, w, h].every(Number.isFinite)) continue;
      chips.push({ cx: x + w / 2, cy: y + h / 2 });
    }
    expect(chips.length).toBeGreaterThanOrEqual(10);

    // Amber corridor sample centres (remasure targets) — slots must stay near these, not chips.
    const AMBER: ReadonlyArray<readonly [TopologySlotEdgeId, number, number]> = [
      ['gm-l2-read', 75.1, 200.3],
      ['gm-l2-write', 75.2, 219.3],
      ['l2-ub', 159.7, 315.2],
      ['ub-l2', 159.6, 331.2],
      ['l2-l1-read', 160.1, 87.9],
      ['ub-vec', 338.7, 351.8],
      ['vec-ub', 338.6, 363.8],
      ['l1-l0a', 239.1, 49.8],
      ['l1-l0b', 239.1, 74.8],
      ['l0a-cube', 300.9, 54.8],
      ['l0b-cube', 300.9, 79.8],
      ['cube-l0c', 373.6, 83.8],
    ];
    for (const [edge, ax, ay] of AMBER) {
      const slots = SLOTS[edge];
      expect(slots.length, edge).toBe(1);
      const [[sx, sy]] = slots;
      expect(Math.hypot(sx - ax, sy - ay), `${edge} vs amber`).toBeLessThan(2.5);
    }

    for (const [edge, slots] of Object.entries(SLOTS)) {
      for (const [sx, sy] of slots) {
        for (const { cx, cy } of chips) {
          const onChip = Math.hypot(sx - cx, sy - cy) < 6;
          expect(onChip, `${edge} slot (${sx}, ${sy}) on chip (${cx}, ${cy})`).toBe(false);
        }
      }
    }
  });

  it('PR-MEMTOP-002: renders data-driven edge labels', () => {
    const wrapper = mount(MemoryTopologyPanel, { props: { model } });
    expect(wrapper.text()).toContain('1.56 GB/s');
    // AIV × 2 chrome: one plate per UB↔SIMD edge (slot index still unique for getByTestId).
    expect(wrapper.find('[data-testid="edge-vec-ub-0"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="edge-vec-ub-1"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="edge-ub-vec-0"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="edge-ub-vec-1"]').exists()).toBe(false);
    for (const id of ['l1-l0a', 'l1-l0b', 'l0a-cube', 'l0b-cube', 'cube-l0c']) {
      expect(wrapper.get(`[data-testid="edge-${id}-0"]`).text().length).toBeGreaterThan(0);
    }
  });

  it('PR-MEMTOP-002c: Cube↔L0C is one plate; Cube util sits under CUBE', () => {
    // Simplified chrome: one corridor plate (~373.5, 85.5) and one under-CUBE util sample
    // (~338.1, 95.3). Remasure must not stack cube-l0c + l0c-cube 5u apart (double GB/s) or
    // park the Cube badge at y=100 (below the sample).
    expect(SLOTS['cube-l0c']).toEqual([[373.6, 83.8]]);
    expect(SLOTS['l0c-cube']).toEqual([]);
    expect(PLATE_SLOTS.cube).toEqual([[338.1, 95.3]]);
    // Cube box is x322–354, y54–123 — badge centre must sit inside it, under the word (~y85).
    const [[cx, cy]] = PLATE_SLOTS.cube;
    expect(cx).toBeGreaterThan(322);
    expect(cx).toBeLessThan(354);
    expect(cy).toBeGreaterThan(84);
    expect(cy).toBeLessThan(110);

    const wrapper = mount(MemoryTopologyPanel, {
      props: {
        model: {
          ...model,
          plates: [{ node: 'cube', label: '0.00%' }],
          edges: model.edges.map((e) =>
            e.id === 'cube-l0c' || e.id === 'l0c-cube'
              ? { ...e, label: '0.00 GB/s' }
              : e,
          ),
        },
      },
    });
    expect(wrapper.find('[data-testid="edge-cube-l0c-0"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="edge-cube-l0c-0"]').text()).toBe('0.00 GB/s');
    expect(wrapper.find('[data-testid="edge-l0c-cube-0"]').exists()).toBe(false);
    const cubeGb = wrapper
      .findAll('text.pr-topo__edge')
      .filter((el) => el.text() === '0.00 GB/s' && Number(el.attributes('x')) > 360);
    expect(cubeGb).toHaveLength(1);
    expect(wrapper.get('[data-testid="plate-cube-0"]').text()).toBe('0.00%');
    expect(Number(wrapper.get('[data-testid="plate-cube-0"]').attributes('y'))).toBeCloseTo(95.3, 5);
  });

  it('PR-MEMTOP-016: unit badges sit on stripped util centres, clear of the unit word', () => {
    // Unit-word white centres (chrome paths) vs under-word util sample centres used for overlays.
    const WORDS: Record<TopologyPlateNodeId, readonly [number, number]> = {
      aiv_scalar: [282.0, 309.07],
      vec: [371.86, 359.07],
      cube: [338.0, 84.57],
    };
    const UTIL: Record<TopologyPlateNodeId, readonly [number, number]> = {
      aiv_scalar: [282.2, 321.0],
      vec: [372.1, 367.8],
      cube: [338.1, 95.3],
    };
    expect(PLATE_SLOTS.aiv_scalar).toEqual([UTIL.aiv_scalar]);
    expect(PLATE_SLOTS.vec).toEqual([UTIL.vec]);
    expect(PLATE_SLOTS.cube).toEqual([UTIL.cube]);
    for (const node of TOPOLOGY_PLATE_NODE_IDS) {
      const [[px, py]] = PLATE_SLOTS[node];
      const [wx, wy] = WORDS[node];
      // Half of BASE_FONT_PX (6.3) mid-baseline ≈ 3.15; require ≥6u so badge body clears the word.
      expect(Math.hypot(px - wx, py - wy), `${node} plate vs word`).toBeGreaterThanOrEqual(6);
    }

    const wrapper = mount(MemoryTopologyPanel, {
      props: {
        model: {
          ...model,
          nodes: [
            ...model.nodes.map((n) =>
              n.id === 'l2' ? { ...n, peakPct: 12.5 } : n,
            ),
            { id: 'vec', label: 'Vec' },
            { id: 'aiv_scalar', label: 'Scalar' },
          ],
          plates: [
            { node: 'aiv_scalar', label: '57.90%' },
            { node: 'vec', label: '2.18%' },
            { node: 'cube', label: '0.00%' },
          ],
        },
      },
    });
    expect(Number(wrapper.get('[data-testid="plate-aiv_scalar-0"]').attributes('y'))).toBeCloseTo(321.0, 5);
    expect(Number(wrapper.get('[data-testid="plate-vec-0"]').attributes('y'))).toBeCloseTo(367.8, 5);
    expect(Number(wrapper.get('[data-testid="node-l2-peak"]').attributes('y'))).toBeCloseTo(218.3, 5);
    expect(Number(wrapper.get('[data-testid="node-l2-peak"]').attributes('x'))).toBeCloseTo(114.1, 5);
    // L2 peak vs L2 word (114.2, 204.5) — must clear half-cap (~3.15); sample band is ~13.8u under.
    expect(Math.hypot(114.1 - 114.2, 218.3 - 204.5)).toBeGreaterThanOrEqual(12);
  });

  it('PR-MEMTOP-002b: every drawn value has a unique testid', () => {
    const wrapper = mount(MemoryTopologyPanel, { props: { model } });
    const drawn = wrapper
      .findAll('[data-testid^="edge-"]')
      .map((el) => el.attributes('data-testid'));
    expect(drawn.length).toBeGreaterThan(1);
    expect(new Set(drawn).size).toBe(drawn.length);
  });

  it('PR-MEMTOP-003: omits NA/missing edge labels', () => {
    const wrapper = mount(MemoryTopologyPanel, { props: { model } });
    const gmWrite = wrapper.findAll('[data-testid="edge-gm-l2-write-0"]');
    expect(gmWrite.length).toBe(1);
    expect(gmWrite[0]!.text()).not.toContain('GB/s');
  });

  it('PR-MEMTOP-004: hides diagram when model empty', () => {
    const wrapper = mount(MemoryTopologyPanel, { props: { model: null } });
    expect(wrapper.find('[data-testid="memory-topology-panel"]').exists()).toBe(false);
  });

  it('PR-MEMTOP-004: hides when only slotless edges are labelled', () => {
    const slotless = {
      nodes: model.nodes,
      edges: [
        { id: 'l0c-l1', from: 'l0c', to: 'l1', label: '7 KB' },
        { id: 'l0c-l2', from: 'l0c', to: 'l2', label: '8 KB' },
        { id: 'l2-l1-write', from: 'l2', to: 'l1', label: '1.00 GB/s' },
      ],
    };
    expect(hasDrawableTopology(slotless)).toBe(false);
    const wrapper = mount(MemoryTopologyPanel, { props: { model: slotless } });
    expect(wrapper.find('[data-testid="memory-topology-panel"]').exists()).toBe(false);
  });

  it('PR-MEMTOP-004: empty-slot l0c-cube alone is not drawable (before fold)', () => {
    const reverseOnly = {
      nodes: model.nodes,
      edges: [{ id: 'l0c-cube', from: 'l0c', to: 'cube', label: '5.00 GB/s' }],
    };
    expect(hasDrawableTopology(reverseOnly)).toBe(false);
    const wrapper = mount(MemoryTopologyPanel, { props: { model: reverseOnly } });
    expect(wrapper.find('[data-testid="memory-topology-panel"]').exists()).toBe(false);
  });

  it('PR-MEMTOP-005: edge labels update when model changes', async () => {
    const wrapper = mount(MemoryTopologyPanel, { props: { model } });
    expect(wrapper.text()).toContain('1.56 GB/s');
    await wrapper.setProps({
      model: {
        ...model,
        edges: [{ id: 'gm-l2-read', from: 'gm', to: 'l2', label: '9.99 GB/s' }],
      },
    });
    expect(wrapper.text()).toContain('9.99 GB/s');
    expect(wrapper.text()).not.toContain('1.56 GB/s');
  });

  it('PR-MEMTOP-006: edge labels sit in the pillar corridors', () => {
    const wrapper = mount(MemoryTopologyPanel, {
      props: {
        model: {
          ...model,
          edges: [
            { id: 'gm-l2-read', from: 'gm', to: 'l2', label: '16.89 GB/s' },
            { id: 'l2-ub', from: 'l2', to: 'ub', label: '16.76 GB/s' },
            { id: 'l2-l1-read', from: 'l2', to: 'l1', label: '1.20 GB/s' },
          ],
        },
      },
    });
    const x = (id: string): number =>
      Number(wrapper.get(`[data-testid="edge-${id}-0"]`).attributes('x'));

    // GM↔L2 labels sit between the GM pillar and the L2 pillar...
    expect(x('gm-l2-read')).toBeGreaterThan(CHROME.gmRight);
    expect(x('gm-l2-read')).toBeLessThan(CHROME.l2Left);
    // L2→L1 and L2→UB sit in the L2↔row corridor (amber sample centres), not on MTE chips.
    expect(x('l2-l1-read')).toBeGreaterThan(CHROME.l2Right);
    expect(x('l2-l1-read')).toBeLessThan(CHROME.clusterLeft);
    expect(x('l2-ub')).toBeGreaterThan(CHROME.l2Right);
    expect(x('l2-ub')).toBeLessThan(CHROME.clusterLeft);
  });

  it('PR-MEMTOP-007: shows L2 Peak(%) when peakPct set', () => {
    const wrapper = mount(MemoryTopologyPanel, {
      props: {
        model: {
          ...model,
          nodes: model.nodes.map((n) => (n.id === 'l2' ? { ...n, peakPct: 81.25 } : n)),
          edges: [
            ...model.edges,
            { id: 'l2-hit', from: 'l2', to: 'l2', label: '81.25%' },
          ],
        },
      },
    });
    expect(wrapper.get('[data-testid="node-l2-peak"]').text()).toBe('81.25%');
    expect(wrapper.text()).not.toMatch(/\bPeak\b/);
    expect(wrapper.find('[data-testid="edge-l2-hit"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="node-l2"]').classes()).toContain('pr-topo__l2');
  });

  it('PR-MEMTOP-007b: omits Peak chrome when peakPct absent', () => {
    const wrapper = mount(MemoryTopologyPanel, { props: { model } });
    expect(wrapper.find('[data-testid="node-l2-peak"]').exists()).toBe(false);
  });

  it('PR-MEMTOP-007c: falls back to the l2-hit label in the same plate', () => {
    const wrapper = mount(MemoryTopologyPanel, {
      props: {
        model: {
          ...model,
          edges: [...model.edges, { id: 'l2-hit', from: 'l2', to: 'l2', label: '77.50%' }],
        },
      },
    });
    // No peakPct, so the one plate shows the hit rate and keeps the `l2-hit` testid.
    const plate = wrapper.get('[data-testid="edge-l2-hit"]');
    expect(plate.text()).toBe('77.50%');
    expect(wrapper.find('[data-testid="node-l2-peak"]').exists()).toBe(false);
    expect(wrapper.findAll('[data-testid="edge-l2-hit"]')).toHaveLength(1);
    expect(wrapper.find('svg').text()).not.toContain('77.50%77.50%');
  });

  it('PR-MEMTOP-016 (UI-49): paints an in-box unit badge per plated unit, blank otherwise', () => {
    const wrapper = mount(MemoryTopologyPanel, {
      props: {
        model: {
          ...model,
          nodes: [...model.nodes, { id: 'vec', label: 'Vec' }, { id: 'aiv_scalar', label: 'Scalar' }],
          plates: [
            { node: 'aiv_scalar', label: '57.90%' },
            { node: 'vec', label: '56.06%' },
          ],
        },
      },
    });
    // One element per plated unit on the AIV × 2 chrome (DATA-28 one field → one badge).
    const scalar = wrapper.findAll('[data-testid^="plate-aiv_scalar-"]');
    expect(scalar).toHaveLength(1);
    expect(scalar.every((el) => el.text() === '57.90%')).toBe(true);
    expect(wrapper.findAll('[data-testid^="plate-vec-"]')).toHaveLength(1);
    expect(wrapper.get('[data-testid="plate-vec-0"]').classes()).toContain('pr-topo__pct');
    // Cube / Scalar(AIC) / SIMT / FixP have no producer field (`NA`), so they carry no badge at
    // all — 2 drawn (scalar + vec), not 11.
    expect(wrapper.findAll('[data-testid^="plate-"]')).toHaveLength(2);

    // The in-box badges join the text alternative, named once per unit.
    const id = wrapper.get('svg').attributes('aria-describedby')!;
    const summary = wrapper.get(`[id="${id}"]`);
    expect(summary.text()).toContain('Scalar: 57.90%');
    expect(summary.text()).toContain('Vec: 56.06%');
    expect(summary.text()).not.toContain('(AIV0, AIV1)');
  });

  it('PR-MEMTOP-008: right-click emits open-details', async () => {
    const wrapper = mount(MemoryTopologyPanel, { props: { model } });
    await wrapper.get('[data-testid="memory-topology-panel"]').trigger('contextmenu');
    expect(wrapper.emitted('open-details')).toHaveLength(1);
  });

  it('PR-MEMTOP-008b: right-click does not emit when openDetailsOnContextmenu is false', async () => {
    const wrapper = mount(MemoryTopologyPanel, {
      props: { model, openDetailsOnContextmenu: false },
    });
    await wrapper.get('[data-testid="memory-topology-panel"]').trigger('contextmenu');
    expect(wrapper.emitted('open-details')).toBeUndefined();
  });

  it('PR-MEMTOP-008c: right-click on the zoom bar is not the diagram gesture', async () => {
    // The bar lives inside the panel that carries the handler, so without a guard a right-click on
    // a control opens the memory CSV overlay over the chrome that was clicked.
    const wrapper = mount(MemoryTopologyPanel, { props: { model } });
    await wrapper.get('[data-testid="topology-zoom-in"]').trigger('contextmenu');
    await wrapper.get('[data-testid="topology-controls"]').trigger('contextmenu');
    expect(wrapper.emitted('open-details')).toBeUndefined();
    // The diagram itself still emits.
    await wrapper.get('[data-testid="topology-viewport"]').trigger('contextmenu');
    expect(wrapper.emitted('open-details')).toHaveLength(1);
  });

  it('PR-MEMTOP-009: edges with no chrome slot are not drawn', () => {
    const wrapper = mount(MemoryTopologyPanel, {
      props: {
        model: {
          ...model,
          edges: [
            ...model.edges,
            { id: 'l2-l1-write', from: 'l2', to: 'l1', label: '9.00 GB/s' },
          ],
        },
      },
    });
    // The export carries no KB plate, so L0C→L1 / L0C→GM datagrams stay in the 详情 tabs.
    // FixP-routed `l2-l1-write` stays blank pending UI-48.
    expect(wrapper.findAll('[data-testid^="edge-l0c-l1"]')).toHaveLength(0);
    expect(wrapper.findAll('[data-testid^="edge-l0c-l2"]')).toHaveLength(0);
    expect(wrapper.findAll('[data-testid^="edge-l2-l1-write"]')).toHaveLength(0);
    expect(wrapper.text()).not.toContain('KB');
    expect(wrapper.text()).not.toContain('9.00 GB/s');
  });

  it('PR-MEMTOP-011: describes the drawn values to assistive tech', () => {
    const wrapper = mount(MemoryTopologyPanel, { props: { model } });
    const id = wrapper.get('svg').attributes('aria-describedby');
    expect(id).toBeTruthy();
    const summary = wrapper.get(`[id="${id}"]`);
    expect(summary.classes()).toContain('pr-topo__sr');
    // Node labels from the model, so the numbers are not bare text.
    expect(summary.text()).toContain('GM → L2 Cache: 1.56 GB/s');
    expect(summary.text()).toContain('L2 Cache → UB: 0.00 GB/s');
    expect(summary.text()).toContain('UB → vec: 0.20 GB/s');
    // AIV × 2 chrome: one slot per edge — not the dual AIV0/AIV1 pair wording.
    expect(summary.text()).not.toContain('(AIV0, AIV1)');
    expect(summary.text().match(/L2 Cache → UB/g)).toHaveLength(1);
    // Only slots the diagram draws: `l0c-l1` / `l0c-l2` carry KB and have no plate.
    expect(summary.text()).not.toContain('KB');
    expect(summary.text()).not.toContain('7 KB');
  });

  it('PR-MEMTOP-012: suppresses overlays and warns once when chrome fails to load', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      // In-box badges are value overlays too: they live at sketch coordinates the chrome does not
      // draw, so they must vanish with the link values rather than float over an empty rectangle.
      const wrapper = mount(MemoryTopologyPanel, {
        props: {
          model: {
            ...model,
            nodes: [...model.nodes, { id: 'vec', label: 'Vec' }],
            plates: [{ node: 'vec', label: '56.06%' }],
          },
        },
      });
      expect(wrapper.find('[data-testid="edge-gm-l2-read-0"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="plate-vec-0"]').exists()).toBe(true);
      expect(wrapper.get('svg').attributes('aria-describedby')).toBeTruthy();
      await wrapper.get('image').trigger('error');
      expect(wrapper.find('[data-testid="edge-gm-l2-read-0"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid^="plate-"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="node-l2"]').exists()).toBe(false);
      expect(wrapper.find('.pr-topo__sr').exists()).toBe(false);
      expect(wrapper.find('[data-testid="topology-controls"]').exists()).toBe(false);
      expect(wrapper.get('svg').attributes('aria-describedby')).toBeUndefined();
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0]?.[0])).toContain('memory-topology.svg');
      await wrapper.get('image').trigger('error');
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });
  it('PR-MEMTOP-011: gives each instance its own description id', () => {
    // A hardcoded id would collide and point both diagrams at one description. `useId` is unique
    // per app, which two separate `mount()` calls would not reproduce (each is its own app).
    const wrapper = mount(TwoPanels, { props: { model } });
    const ids = wrapper.findAll('svg[role="img"]').map((s) => s.attributes('aria-describedby'));
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    expect(wrapper.findAll('.pr-topo__sr')).toHaveLength(2);
    expect(wrapper.get(`[id="${ids[0]}"]`).text()).toBe(wrapper.get(`[id="${ids[1]}"]`).text());
    expect(wrapper.get(`[id="${ids[0]}"]`).text().length).toBeGreaterThan(0);
  });
});

describe('MemoryTopologyPanel zoom / fullscreen bar (PR-MEMTOP-013/014/015)', () => {
  it('PR-MEMTOP-014: renders 缩小 / readout / 放大 / 适应窗口 in the export order', () => {
    const wrapper = mount(MemoryTopologyPanel, { props: { model } });
    const bar = wrapper.get('[data-testid="topology-controls"]');
    expect(
      bar.findAll('button, span[data-testid]').map((n) => n.attributes('data-testid')),
    ).toEqual([
      'topology-zoom-out',
      'topology-zoom-percent',
      'topology-zoom-in',
      'topology-zoom-fit',
    ]);
    expect(wrapper.get('[data-testid="topology-zoom-out"]').attributes('aria-label')).toBe('缩小');
    expect(wrapper.get('[data-testid="topology-zoom-in"]').attributes('aria-label')).toBe('放大');
    expect(wrapper.get('[data-testid="topology-zoom-fit"]').attributes('aria-label')).toBe(
      '适应窗口',
    );
    // No host asked for fullscreen here (the overlay is already full).
    expect(wrapper.find('[data-testid="topology-fullscreen"]').exists()).toBe(false);
  });

  it('PR-MEMTOP-014: renders 全屏 last only when the host asks for it', async () => {
    const wrapper = mount(MemoryTopologyPanel, { props: { model, showFullscreen: true } });
    const bar = wrapper.get('[data-testid="topology-controls"]');
    expect(bar.findAll('button').map((b) => b.attributes('data-testid'))).toEqual([
      'topology-zoom-out',
      'topology-zoom-in',
      'topology-zoom-fit',
      'topology-fullscreen',
    ]);
    const fullscreen = wrapper.get('[data-testid="topology-fullscreen"]');
    expect(fullscreen.attributes('aria-label')).toBe('全屏');
    // The panel never mounts the overlay itself — it only asks the host.
    expect(wrapper.find('[data-testid="topology-fullscreen-overlay"]').exists()).toBe(false);
    await fullscreen.trigger('click');
    expect(wrapper.emitted('open-fullscreen')).toHaveLength(1);
  });

  it('PR-MEMTOP-015: steps the ladder one stop per click and clamps at both ends', async () => {
    const wrapper = mount(MemoryTopologyPanel, { props: { model } });
    const readout = wrapper.get('[data-testid="topology-zoom-percent"]');
    const zoomIn = wrapper.get('[data-testid="topology-zoom-in"]');
    const zoomOut = wrapper.get('[data-testid="topology-zoom-out"]');
    expect(readout.text()).toBe('100%');
    // Both ends of the ladder are reachable — and disabled there, not silently no-op.
    expect(zoomOut.attributes('disabled')).toBeUndefined();
    await zoomOut.trigger('click');
    expect(readout.text()).toBe('75%');
    await zoomOut.trigger('click');
    expect(readout.text()).toBe('50%');
    expect(zoomOut.attributes('disabled')).toBeDefined();
    for (let i = 0; i < ZOOM_STEPS.length; i++) await zoomIn.trigger('click');
    expect(readout.text()).toBe('400%');
    expect(zoomIn.attributes('disabled')).toBeDefined();
  });

  it('PR-MEMTOP-015: 适应窗口 resets the readout and the scroll origin', async () => {
    const wrapper = mount(MemoryTopologyPanel, { props: { model } });
    await wrapper.get('[data-testid="topology-zoom-in"]').trigger('click');
    expect(wrapper.get('[data-testid="topology-zoom-percent"]').text()).toBe('125%');
    const viewport = wrapper.get<HTMLElement>('[data-testid="topology-viewport"]').element;
    viewport.scrollTop = 120;
    viewport.scrollLeft = 40;
    await wrapper.get('[data-testid="topology-zoom-fit"]').trigger('click');
    expect(wrapper.get('[data-testid="topology-zoom-percent"]').text()).toBe('100%');
    expect(viewport.scrollTop).toBe(0);
    expect(viewport.scrollLeft).toBe(0);
  });

  it('PR-MEMTOP-015: each panel instance keeps its own zoom', async () => {
    const wrapper = mount(TwoPanels, { props: { model } });
    const bars = wrapper.findAll('[data-testid="topology-zoom-in"]');
    await bars[0]!.trigger('click');
    const readouts = wrapper.findAll('[data-testid="topology-zoom-percent"]');
    expect(readouts[0]!.text()).toBe('125%');
    expect(readouts[1]!.text()).toBe('100%');
  });

  it('PR-MEMTOP-013: the diagram sits in a stage of its own, scaled by the zoom', async () => {
    // The ratio itself is CSS (`aspect-ratio` on the box and the stage, measured in the browser —
    // see the spec and tests/e2e/topology-zoom-geometry.spec.ts); jsdom has no layout, so what is
    // checkable here is that the stage is the diagram's own box between the window and the `svg`,
    // and that the zoom actually reaches it.
    const wrapper = mount(MemoryTopologyPanel, { props: { model } });
    const root = wrapper.get('[data-testid="memory-topology-panel"]');
    const viewport = wrapper.get('[data-testid="topology-viewport"]');
    const stage = viewport.get('.pr-topo__stage');
    expect(stage.get('svg[role="img"]').attributes('viewBox')).toBe('0 0 448 423');
    const scale = () => root.attributes('style') ?? '';
    expect(scale()).toMatch(/--pr-topo-zoom:\s*1(\.0+)?(;|$)/);
    await wrapper.get('[data-testid="topology-zoom-in"]').trigger('click');
    expect(scale()).toMatch(/--pr-topo-zoom:\s*1\.25(;|$)/);
    await wrapper.get('[data-testid="topology-zoom-fit"]').trigger('click');
    expect(scale()).toMatch(/--pr-topo-zoom:\s*1(\.0+)?(;|$)/);
  });

  it('PR-MEMTOP-013: the fit box only scrolls past the fit, so the fitted state has no scrollbar', async () => {
    const wrapper = mount(MemoryTopologyPanel, { props: { model } });
    const viewport = wrapper.get('[data-testid="topology-viewport"]');
    // 100% and below: the stage is at most the box, so there is nothing to scroll to.
    expect(viewport.classes()).not.toContain('pr-topo__viewport--pannable');
    await wrapper.get('[data-testid="topology-zoom-out"]').trigger('click');
    expect(wrapper.get('[data-testid="topology-zoom-percent"]').text()).toBe('75%');
    expect(viewport.classes()).not.toContain('pr-topo__viewport--pannable');
    // Past the fit the diagram is larger than its box, and panning is the platform's own scroll.
    await wrapper.get('[data-testid="topology-zoom-in"]').trigger('click');
    await wrapper.get('[data-testid="topology-zoom-in"]').trigger('click');
    expect(wrapper.get('[data-testid="topology-zoom-percent"]').text()).toBe('125%');
    expect(viewport.classes()).toContain('pr-topo__viewport--pannable');
    // 适应窗口 puts it back to the non-scrolling fitted state.
    await wrapper.get('[data-testid="topology-zoom-fit"]').trigger('click');
    expect(viewport.classes()).not.toContain('pr-topo__viewport--pannable');
  });

  it('PR-MEMTOP-015: stepping back down to a fitted stop also restores the scroll origin', async () => {
    const wrapper = mount(MemoryTopologyPanel, { props: { model } });
    const viewport = wrapper.get<HTMLElement>('[data-testid="topology-viewport"]').element;
    const zoomIn = wrapper.get('[data-testid="topology-zoom-in"]');
    await zoomIn.trigger('click');
    expect(wrapper.get('[data-testid="topology-zoom-percent"]').text()).toBe('125%');
    // Pan the zoomed diagram, then walk back down to 100% with the ladder — not with 适应窗口.
    viewport.scrollTop = 120;
    viewport.scrollLeft = 40;
    await wrapper.get('[data-testid="topology-zoom-out"]').trigger('click');
    expect(wrapper.get('[data-testid="topology-zoom-percent"]').text()).toBe('100%');
    expect(viewport.scrollTop).toBe(0);
    expect(viewport.scrollLeft).toBe(0);
  });

  it('PR-MEMTOP-018: a zoom step re-centres on the part that was under the middle', async () => {
    // jsdom has no layout, so the box's scroll geometry is stood in for. It is sized from the same
    // `--pr-topo-zoom` the stage is sized from, so the stub moves with the component's own scale —
    // which is also what makes the write-back assertion meaningful: the new `scrollWidth` has to be
    // read after the step, not carried over from before it.
    const wrapper = mount(MemoryTopologyPanel, { props: { model } });
    const root = wrapper.get('[data-testid="memory-topology-panel"]').element as HTMLElement;
    const el = wrapper.get<HTMLElement>('[data-testid="topology-viewport"]').element;
    const scale = () =>
      Number(/--pr-topo-zoom:\s*([\d.]+)/.exec(root.getAttribute('style') ?? '')?.[1] ?? 1);
    const BOX = { w: 448, h: 423 };
    Object.defineProperty(el, 'clientWidth', { configurable: true, get: () => BOX.w });
    Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => BOX.h });
    Object.defineProperty(el, 'scrollWidth', { configurable: true, get: () => BOX.w * scale() });
    Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => BOX.h * scale() });

    // Fitted: the stage is the box, so the middle is the drawing's own middle — half of it.
    await wrapper.get('[data-testid="topology-zoom-in"]').trigger('click');
    expect(wrapper.get('[data-testid="topology-zoom-percent"]').text()).toBe('125%');
    // 0.5 × 560 − 224 and 0.5 × 528.75 − 211.5, i.e. half of each step's own overflow.
    expect(el.scrollLeft).toBeCloseTo(56, 6);
    expect(el.scrollTop).toBeCloseTo(52.875, 6);

    // Panned by hand, then stepped up to 150%: the fraction under the middle is what is kept, not
    // the offset — `(60 + 224) / 560` and `(100 + 211.5) / 528.75` of the new 672 × 634.5 stage.
    el.scrollLeft = 60;
    el.scrollTop = 100;
    await wrapper.get('[data-testid="topology-zoom-in"]').trigger('click');
    expect(wrapper.get('[data-testid="topology-zoom-percent"]').text()).toBe('150%');
    expect(el.scrollLeft).toBeCloseTo(116.8, 1);
    expect(el.scrollTop).toBeCloseTo(162.3, 1);
  });

  it('PR-MEMTOP-018: a box with no layout is left alone rather than centred on nothing', async () => {
    // The jsdom escape hatch, and the state every other test in this file runs in: no box means no
    // middle, no fraction to divide by, and — the part that matters — no `NaN` written to the offset
    // a later pan would then read as its origin.
    const wrapper = mount(MemoryTopologyPanel, { props: { model } });
    const el = wrapper.get<HTMLElement>('[data-testid="topology-viewport"]').element;
    await wrapper.get('[data-testid="topology-zoom-in"]').trigger('click');
    expect(wrapper.get('[data-testid="topology-zoom-percent"]').text()).toBe('125%');
    expect(el.scrollLeft).toBe(0);
    expect(el.scrollTop).toBe(0);
  });

  it('PR-MEMTOP-019: a step tweens the painted scale, while the bar commits its stop at once', async () => {
    // Frames by hand here — the file's gear lands every step immediately — so the two halves of a
    // step can be seen apart: the stop the bar has committed to, and the scale painted between the
    // stop it left and the stop it is heading for.
    const queued: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => queued.push(cb));
    const wrapper = mount(MemoryTopologyPanel, { props: { model } });
    const root = wrapper.get('[data-testid="memory-topology-panel"]');
    const viewport = wrapper.get('[data-testid="topology-viewport"]');
    const scale = () =>
      Number(/--pr-topo-zoom:\s*([\d.]+)/.exec(root.attributes('style') ?? '')?.[1] ?? 1);

    await wrapper.get('[data-testid="topology-zoom-in"]').trigger('click');
    // Committed on the click, so the readout and the ladder ends do not lag the tween — while
    // `pannable` deliberately does: it reads the *painted* scale, because the box only becomes a
    // scroll container once the drawing actually overflows it (PR-MEMTOP-013).
    expect(wrapper.get('[data-testid="topology-zoom-percent"]').text()).toBe('125%');
    expect(root.attributes('data-topo-zoom-animating')).toBe('true');
    // …while the painted scale is still the stop the step left, because no frame has run yet.
    expect(scale()).toBe(1);
    expect(viewport.classes()).not.toContain('pr-topo__viewport--pannable');

    // Half way (200 of the 400ms) the drawing is between the two stops — and the readout is not.
    queued.shift()!(performance.now() + 200);
    await nextTick();
    expect(scale()).toBeGreaterThan(1);
    expect(scale()).toBeLessThan(1.25);
    expect(wrapper.get('[data-testid="topology-zoom-percent"]').text()).toBe('125%');
    expect(viewport.classes()).toContain('pr-topo__viewport--pannable');

    // Landed: the painted scale *is* the committed stop, and the flag goes back down for the
    // browser tests that settle on it (PR-MEMTOP-019).
    while (queued.length) queued.shift()!(performance.now() + 10_000);
    await nextTick();
    expect(scale()).toBe(1.25);
    expect(root.attributes('data-topo-zoom-animating')).toBe('false');
  });

  it('PR-MEMTOP-019b: reduced motion lands the step on the click, without spending a frame', async () => {
    // `animateProgress` owns this rule (it is the same one the lane collapse rides), so what is
    // asserted here is the panel's side of it: the step is *landed*, not merely queued — no frame
    // is asked for at all, and the scale is the new stop by the time the click returns.
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const raf = vi.fn((cb: FrameRequestCallback) => {
      cb(performance.now() + 10_000);
      return 1;
    });
    vi.stubGlobal('requestAnimationFrame', raf);
    const wrapper = mount(MemoryTopologyPanel, { props: { model } });
    const root = wrapper.get('[data-testid="memory-topology-panel"]');
    const scale = () =>
      Number(/--pr-topo-zoom:\s*([\d.]+)/.exec(root.attributes('style') ?? '')?.[1] ?? 1);

    await wrapper.get('[data-testid="topology-zoom-in"]').trigger('click');
    expect(wrapper.get('[data-testid="topology-zoom-percent"]').text()).toBe('125%');
    expect(scale()).toBe(1.25);
    expect(root.attributes('data-topo-zoom-animating')).toBe('false');
    expect(raf).not.toHaveBeenCalled();
  });
});

describe('MemoryTopologyPanel drag-to-pan (PR-MEMTOP-017)', () => {
  /** happy-dom has no layout: `getBoundingClientRect()` is all zeros and `clientWidth` is 0, so a
   *  press is given its box coordinates the way the component reads them — `clientX` against the
   *  border box — and the box's own size is stubbed where the test needs a scrollbar band. */
  function press(el: Element, type: string, init: PointerEventInit): void {
    el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, ...init }));
  }

  it('PR-MEMTOP-017: drags the diagram 1:1 with the pointer, past the fit only', async () => {
    const wrapper = mount(MemoryTopologyPanel, { props: { model } });
    const viewport = wrapper.get<HTMLElement>('[data-testid="topology-viewport"]');
    const el = viewport.element;

    // Fitted: the box is not a scroll container (PR-MEMTOP-013), so the drag has nowhere to go.
    press(el, 'pointerdown', { button: 0, clientX: 300, clientY: 300 });
    press(el, 'pointermove', { button: 0, buttons: 1, clientX: 260, clientY: 270 });
    press(el, 'pointerup', { button: 0, clientX: 260, clientY: 270 });
    expect(el.scrollLeft).toBe(0);
    expect(el.scrollTop).toBe(0);

    await wrapper.get('[data-testid="topology-zoom-in"]').trigger('click');
    press(el, 'pointerdown', { button: 0, clientX: 300, clientY: 300 });
    await nextTick();
    expect(viewport.classes()).toContain('pr-topo__viewport--dragging');
    // 1:1 and in the pointer's direction: 40px left / 30px up moves the drawing with the cursor.
    press(el, 'pointermove', { button: 0, buttons: 1, clientX: 260, clientY: 270 });
    expect(el.scrollLeft).toBe(40);
    expect(el.scrollTop).toBe(30);

    // A grab from an already-panned origin, in two legs: every move applies the *whole* travel
    // from the press point to the origin that press captured, never a per-move delta. Both legs
    // stay inside the range, so this is what a browser does rather than a clamped hypothetical.
    el.scrollLeft = 100;
    press(el, 'pointerup', { button: 0, clientX: 260, clientY: 270 });
    press(el, 'pointerdown', { button: 0, clientX: 300, clientY: 300 });
    press(el, 'pointermove', { button: 0, buttons: 1, clientX: 320, clientY: 300 });
    expect(el.scrollLeft).toBe(80);
    press(el, 'pointermove', { button: 0, buttons: 1, clientX: 340, clientY: 300 });
    expect(el.scrollLeft).toBe(60);
    // The vertical origin is whatever the box was at the press — still 30 here, and the pointer
    // has not moved in y, so it stays there.
    expect(el.scrollTop).toBe(30);

    press(el, 'pointerup', { button: 0, clientX: 340, clientY: 300 });
    await nextTick();
    expect(viewport.classes()).not.toContain('pr-topo__viewport--dragging');
    // Released: the pan is over, and 适应窗口 still has the scroll origin to return to.
    press(el, 'pointermove', { button: 0, buttons: 1, clientX: 100, clientY: 100 });
    expect(el.scrollLeft).toBe(60);
    await wrapper.get('[data-testid="topology-zoom-fit"]').trigger('click');
    expect(el.scrollLeft).toBe(0);
    expect(el.scrollTop).toBe(0);
  });

  it('PR-MEMTOP-019: a drag during a step owns the offset, and the step re-anchors on it', async () => {
    // Frames by hand, so the step is still in flight when the pointer moves — the file's gear lands
    // every step inside the click, which is the one state this interaction cannot happen in.
    const queued: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => queued.push(cb));
    const wrapper = mount(MemoryTopologyPanel, { props: { model } });
    const root = wrapper.get('[data-testid="memory-topology-panel"]').element as HTMLElement;
    const el = wrapper.get<HTMLElement>('[data-testid="topology-viewport"]').element;
    // Laid out, and sized from the same scale the stage is (PR-MEMTOP-018's stand-in for jsdom),
    // so the placement maths below is exercised rather than skipped on a zero-sized box.
    const scale = () =>
      Number(/--pr-topo-zoom:\s*([\d.]+)/.exec(root.getAttribute('style') ?? '')?.[1] ?? 1);
    const BOX = { w: 448, h: 423 };
    Object.defineProperty(el, 'clientWidth', { configurable: true, get: () => BOX.w });
    Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => BOX.h });
    Object.defineProperty(el, 'scrollWidth', { configurable: true, get: () => BOX.w * scale() });
    Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => BOX.h * scale() });
    /** The middle of the box as a fraction of what it can scroll — what PR-MEMTOP-018 holds. */
    const middle = () => ({
      x: (el.scrollLeft + el.clientWidth / 2) / el.scrollWidth,
      y: (el.scrollTop + el.clientHeight / 2) / el.scrollHeight,
    });

    // Half way through a step up: the drawing overflows its box, so there is a pan to make.
    await wrapper.get('[data-testid="topology-zoom-in"]').trigger('click');
    queued.shift()!(performance.now() + 200);
    await nextTick();
    expect(scale()).toBeGreaterThan(1);
    expect(scale()).toBeLessThan(1.25);
    expect(el.scrollLeft).toBeGreaterThan(0);

    // A drag from the middle takes the offset with it, 1:1, as it does outside a step.
    const beforeDrag = { left: el.scrollLeft, top: el.scrollTop };
    press(el, 'pointerdown', { button: 0, pointerId: 7, clientX: 200, clientY: 200 });
    press(el, 'pointermove', { button: 0, buttons: 1, pointerId: 7, clientX: 160, clientY: 170 });
    const dragged = middle();
    expect(el.scrollLeft).toBeCloseTo(beforeDrag.left + 40, 6);
    expect(el.scrollTop).toBeCloseTo(beforeDrag.top + 30, 6);
    // The drag moved the middle off the step's own anchor, which is what the frames below judge.
    expect(dragged.x).not.toBeCloseTo(0.5, 3);

    // A frame lands under the live pointer: the placement stands down rather than rubber-banding
    // the diagram back out from under the gesture (the offset the drag wrote is the offset kept).
    queued.shift()!(performance.now() + 260);
    await nextTick();
    expect(el.scrollLeft).toBeCloseTo(beforeDrag.left + 40, 6);
    expect(el.scrollTop).toBeCloseTo(beforeDrag.top + 30, 6);

    // Released, the flight's remaining frames carry on from *that* middle — the arrow the pointer
    // handed over — instead of yanking the drawing back to the middle the step aimed at.
    press(el, 'pointerup', { button: 0, pointerId: 7, clientX: 160, clientY: 170 });
    queued.shift()!(performance.now() + 320);
    await nextTick();
    const held = middle();
    expect(held.x).toBeCloseTo(dragged.x, 4);
    expect(held.y).toBeCloseTo(dragged.y, 4);

    // And the step still lands on its committed stop.
    while (queued.length) queued.shift()!(performance.now() + 10_000);
    await nextTick();
    expect(scale()).toBe(1.25);
  });

  it('PR-MEMTOP-019: a wheel or a thumb during a step owns the offset too', async () => {
    // The third and fourth writers of `scrollLeft` / `scrollTop`: a wheel and a classic thumb are
    // the platform's own scroll, so unlike the drag there is no handler to hook — the box's `scroll`
    // event is the only notice the panel gets, and it is what has to re-read the anchor.
    const queued: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => queued.push(cb));
    const wrapper = mount(MemoryTopologyPanel, { props: { model } });
    const root = wrapper.get('[data-testid="memory-topology-panel"]').element as HTMLElement;
    const el = wrapper.get<HTMLElement>('[data-testid="topology-viewport"]').element;
    const scale = () =>
      Number(/--pr-topo-zoom:\s*([\d.]+)/.exec(root.getAttribute('style') ?? '')?.[1] ?? 1);
    const BOX = { w: 448, h: 423 };
    Object.defineProperty(el, 'clientWidth', { configurable: true, get: () => BOX.w });
    Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => BOX.h });
    Object.defineProperty(el, 'scrollWidth', { configurable: true, get: () => BOX.w * scale() });
    Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => BOX.h * scale() });
    const middle = () => ({
      x: (el.scrollLeft + el.clientWidth / 2) / el.scrollWidth,
      y: (el.scrollTop + el.clientHeight / 2) / el.scrollHeight,
    });
    /** A user scroll: the write is the platform's, and only the event says so. */
    const userScroll = (left: number, top: number) => {
      el.scrollLeft = left;
      el.scrollTop = top;
      el.dispatchEvent(new Event('scroll'));
    };

    await wrapper.get('[data-testid="topology-zoom-in"]').trigger('click');
    queued.shift()!(performance.now() + 200);
    await nextTick();
    expect(scale()).toBeGreaterThan(1);

    // A wheel moves the box; the event re-reads the anchor, so the frames after it hold the middle
    // the wheel left rather than the one the step started with.
    userScroll(80, 90);
    const wheeled = middle();
    queued.shift()!(performance.now() + 260);
    await nextTick();
    const held = middle();
    expect(held.x).toBeCloseTo(wheeled.x, 4);
    expect(held.y).toBeCloseTo(wheeled.y, 4);

    // The placement's own writes are not mistaken for a pan: they raise `scroll` too, and the offset
    // they leave is the one the anchor already asked for, so the step stays on it rather than
    // drifting to whatever the clamped read-back happens to be.
    queued.shift()!(performance.now() + 320);
    await nextTick();
    expect(middle().x).toBeCloseTo(wheeled.x, 4);

    while (queued.length) queued.shift()!(performance.now() + 10_000);
    await nextTick();
    expect(scale()).toBe(1.25);
  });

  it('PR-MEMTOP-017: a pointercancel ends the drag, as the platform sends one when it takes over', async () => {
    // Any platform takeover — a pen handed to the OS scroll, a browser gesture — cancels the
    // element's pointer, so the `grabbing` state must not survive it. (A finger never gets here:
    // `onPanStart` refuses touch, leaving it to the platform's own scroll.)
    const wrapper = mount(MemoryTopologyPanel, { props: { model } });
    const viewport = wrapper.get<HTMLElement>('[data-testid="topology-viewport"]');
    const el = viewport.element;
    await wrapper.get('[data-testid="topology-zoom-in"]').trigger('click');
    press(el, 'pointerdown', { button: 0, clientX: 300, clientY: 300 });
    await nextTick();
    expect(viewport.classes()).toContain('pr-topo__viewport--dragging');
    press(el, 'pointercancel', { button: 0, clientX: 300, clientY: 300 });
    await nextTick();
    expect(viewport.classes()).not.toContain('pr-topo__viewport--dragging');
    press(el, 'pointermove', { button: 0, buttons: 1, clientX: 260, clientY: 300 });
    expect(el.scrollLeft).toBe(0);
  });

  it('PR-MEMTOP-017: a press on a scrollbar, a non-primary button, or a finger is not a pan', async () => {
    const wrapper = mount(MemoryTopologyPanel, { props: { model } });
    await wrapper.get('[data-testid="topology-zoom-in"]').trigger('click');
    const el = wrapper.get<HTMLElement>('[data-testid="topology-viewport"]').element;
    // A box with a size, as a laid-out one has. `clientWidth` is 0 without layout, which is why the
    // component skips its scrollbar check on a zero-sized box — the same escape hatch this needs.
    Object.defineProperty(el, 'clientWidth', { value: 380, configurable: true });
    Object.defineProperty(el, 'clientHeight', { value: 500, configurable: true });

    const viewport = wrapper.get<HTMLElement>('[data-testid="topology-viewport"]');
    // Touch: left to the platform's own scroll. Not arming the gesture is what keeps its
    // `pointercancel` handover on time, and it keeps the `grabbing` cursor off a finger.
    press(el, 'pointerdown', { pointerType: 'touch', button: 0, clientX: 300, clientY: 300 });
    await nextTick();
    expect(viewport.classes()).not.toContain('pr-topo__viewport--dragging');
    press(el, 'pointermove', { pointerType: 'touch', button: 0, buttons: 1, clientX: 260, clientY: 270 });
    expect(el.scrollLeft).toBe(0);
    expect(el.scrollTop).toBe(0);

    // Middle button: the platform's own gesture space (autoscroll), never a pan.
    press(el, 'pointerdown', { button: 1, clientX: 300, clientY: 300 });
    press(el, 'pointermove', { button: 1, buttons: 4, clientX: 260, clientY: 270 });
    expect(el.scrollLeft).toBe(0);
    expect(el.scrollTop).toBe(0);

    // A classic bar sits past the client box; its press belongs to the platform's thumb.
    press(el, 'pointerdown', { button: 0, clientX: 396, clientY: 300 });
    press(el, 'pointermove', { button: 0, buttons: 1, clientX: 356, clientY: 270 });
    expect(el.scrollLeft).toBe(0);
    expect(el.scrollTop).toBe(0);

    // …and the drawing still drags in the same box — including while panned, where a test measured
    // against the content rather than the box would have read the press as a bar (see the component).
    el.scrollLeft = 100;
    press(el, 'pointerdown', { button: 0, clientX: 300, clientY: 300 });
    press(el, 'pointermove', { button: 0, buttons: 1, clientX: 280, clientY: 300 });
    expect(el.scrollLeft).toBe(120);
  });
});

describe('MemoryTopologyPanel value fit (PR-MEMTOP-010)', () => {
  /** Natural widths measured in Chrome for this panel's type (6.3px/800, system sans). */
  const WIDTHS: Record<string, number> = {
    '504.00 GB/s': 43.19,
    '12.34 GB/s': 37.33,
    '1.56 GB/s': 32.75,
    '100.00%': 31.11,
  };

  /** jsdom has no SVG text metrics; stand in for the browser's `getComputedTextLength`. */
  function stubMetrics(): () => void {
    const proto = SVGTextElement.prototype as unknown as Record<string, unknown>;
    const had = Object.prototype.hasOwnProperty.call(proto, 'getComputedTextLength');
    const prev = proto.getComputedTextLength;
    proto.getComputedTextLength = function (this: SVGTextElement) {
      return WIDTHS[this.textContent ?? ''] ?? 20;
    };
    return () => {
      if (had) proto.getComputedTextLength = prev;
      else delete proto.getComputedTextLength;
    };
  }

  it('keeps the base size while a value fits its corridor', () => {
    expect(fitFontSize(37.33, 'l2-ub')).toBe(6.3); // 37.33 ≤ the link bound
    expect(fitFontSize(43.19, 'l2-l1-read')).toBe(6.3);
    expect(fitFontSize(31.11, 'l2-peak')).toBe(6.3); // `100.00%` inside the 40-unit pillar
    expect(fitFontSize(0, 'gm-l2-read')).toBe(6.3); // blank slot
  });

  it('keeps every slot bound inside its own corridor', () => {
    // Walls measured off the export at each slot's own height band; a value is centred on its
    // slot, so the nearer wall binds. This covers *every* slot: the row stack's inner corridors
    // are much tighter than the pillars' and once shared a single (too generous) default.
    const CORRIDORS: Record<string, [number, number, number]> = {
      // slot: [left wall, slot centre, right wall]
      'gm-l2-read': [55.75, 75.1, 94],
      'gm-l2-write': [55.75, 75.2, 94],
      'l2-ub': [133.75, 159.7, 188],
      'ub-l2': [133.75, 159.6, 188],
      'l2-l1-read': [133.75, 160.1, 188],
      'ub-vec': [315, 338.7, 361],
      'vec-ub': [315, 338.6, 361],
      'l1-l0a': [217, 239.1, 262],
      'l1-l0b': [217, 239.1, 262],
      'l0a-cube': [282, 300.9, 322],
      'l0b-cube': [282, 300.9, 322],
      'cube-l0c': [353, 373.6, 394],
      'l2-peak': [94, 114.1, 133.75],
    };
    expect(Object.keys(SLOT_MAX_W).sort()).toEqual(Object.keys(CORRIDORS).sort());
    for (const [slot, [left, centre, right]] of Object.entries(CORRIDORS)) {
      const half = SLOT_MAX_W[slot]! / 2;
      expect(centre - half, `${slot} left`).toBeGreaterThanOrEqual(left);
      expect(centre + half, `${slot} right`).toBeLessThanOrEqual(right);
    }
  });

  it('keeps every in-box badge bound inside its own unit box', () => {
    // The sketch's nine in-box badges; only the plated three get a slot (UI-49), and each has to
    // stay inside its own box wall — these are box interiors, not the corridors between pillars.
    // Walls measured off the export at each badge's height band: AIV × 2 `Scalar` x256–308,
    // AIV × 2 `Vec`/SIMD x361.5–382.5 (the narrow one), AIC `Cube` x322–354.
    const BOXES: Record<TopologyPlateNodeId, [number, number, number]> = {
      aiv_scalar: [256, 282.2, 308],
      vec: [361.5, 372.1, 382.5],
      cube: [322, 338.1, 354],
    };
    expect(Object.keys(PLATE_MAX_W).sort()).toEqual(Object.keys(BOXES).sort());
    expect(Object.keys(PLATE_SLOTS).sort()).toEqual([...TOPOLOGY_PLATE_NODE_IDS].sort());
    for (const node of TOPOLOGY_PLATE_NODE_IDS) {
      const [left, centre, right] = BOXES[node];
      const half = PLATE_MAX_W[node] / 2;
      expect(centre - half, `${node} left`).toBeGreaterThanOrEqual(left);
      expect(centre + half, `${node} right`).toBeLessThanOrEqual(right);
    }
  });

  it('shrinks an in-box badge that outgrows the narrow Vec box', () => {
    // `100.00%` measures 31.11 units — wider than any unit box at its badge band — so each box
    // scales it by its own wall, the 22-unit Vec box the most. Badges are not corridor values:
    // they never consult `SLOT_MAX_W`.
    expect(fitFontSize(31.11, 'vec', 6.3, PLATE_MAX_W)).toBeCloseTo(
      (PLATE_MAX_W['vec']! / 31.11) * 6.3,
      6,
    );
    for (const node of ['cube', 'aiv_scalar'] as const) {
      expect(fitFontSize(31.11, node, 6.3, PLATE_MAX_W), node).toBeLessThan(6.3);
      expect(fitFontSize(31.11, node, 6.3, PLATE_MAX_W), node).toBeCloseTo(
        (PLATE_MAX_W[node]! / 31.11) * 6.3,
        6,
      );
    }
    // A badge the box holds keeps the base size.
    expect(fitFontSize(15, 'vec', 6.3, PLATE_MAX_W)).toBe(6.3);
  });

  it('shrinks a value that outgrows the tight GM↔L2 corridor', () => {
    const tight = SLOT_MAX_W['gm-l2-read']!;
    expect(fitFontSize(43.19, 'gm-l2-read')).toBeCloseTo((tight / 43.19) * 6.3, 6);
    expect(fitFontSize(37.33, 'gm-l2-write')).toBeLessThan(6.3);
  });

  it('shrinks a value that outgrows a tight row-stack corridor', () => {
    // 43.19 units overflows L0B↔Cube / Cube↔L0C / L1↔L0A, which the old single default let pass.
    // (Values this wide are real: the sample fixture's GM↔L2 label is already `504.00 GB/s`.)
    for (const slot of ['l0b-cube', 'cube-l0c', 'l1-l0a', 'ub-vec']) {
      expect(fitFontSize(43.19, slot), slot).toBeLessThan(6.3);
      expect(fitFontSize(43.19, slot), slot).toBeCloseTo((SLOT_MAX_W[slot]! / 43.19) * 6.3, 6);
    }
    // …and a 3-digit value alone is enough to overflow the tightest of them.
    expect(fitFontSize(41.7, 'l0b-cube')).toBeLessThan(6.3);
    expect(fitFontSize(41.7, 'l0b-cube')).toBeCloseTo((SLOT_MAX_W['l0b-cube']! / 41.7) * 6.3, 6);
    // While the wide pillar corridors still hold those values at full size.
    expect(fitFontSize(43.19, 'l2-ub')).toBe(6.3);
  });

  it('falls back to the tightest bound for a slot the table forgets', () => {
    const tightest = Math.min(...Object.values(SLOT_MAX_W));
    expect(DEFAULT_MAX_W).toBe(tightest);
    expect(fitFontSize(DEFAULT_MAX_W, 'nope')).toBe(6.3);
    expect(fitFontSize(DEFAULT_MAX_W + 1, 'nope')).toBeLessThan(6.3);
  });

  it('PR-MEMTOP-010: applies the fitted size only to the over-wide label', async () => {
    const restore = stubMetrics();
    try {
      const wrapper = mount(MemoryTopologyPanel, {
        props: {
          model: {
            ...model,
            edges: [
              { id: 'gm-l2-read', from: 'gm', to: 'l2', label: '504.00 GB/s' },
              { id: 'l2-ub', from: 'l2', to: 'ub', label: '1.56 GB/s' },
            ],
          },
        },
      });
      await nextTick();
      const wide = wrapper.get('[data-testid="edge-gm-l2-read-0"]');
      const fits = wrapper.get('[data-testid="edge-l2-ub-0"]');
      expect(wide.text()).toBe('504.00 GB/s');
      const px = /font-size:\s*([\d.]+)px/.exec(wide.attributes('style') ?? '')?.[1];
      expect(Number(px)).toBeCloseTo((SLOT_MAX_W['gm-l2-read']! / 43.19) * 6.3, 4);
      expect(fits.attributes('style') ?? '').not.toContain('font-size');
    } finally {
      restore();
    }
  });

  it('PR-MEMTOP-016: applies the fitted size to an over-wide in-box badge', async () => {
    const restore = stubMetrics();
    try {
      const wrapper = mount(MemoryTopologyPanel, {
        props: {
          model: { ...model, plates: [{ node: 'vec', label: '100.00%' }] },
        },
      });
      await nextTick();
      const plate = wrapper.get('[data-testid="plate-vec-0"]');
      expect(plate.text()).toBe('100.00%');
      const px = /font-size:\s*([\d.]+)px/.exec(plate.attributes('style') ?? '')?.[1];
      expect(Number(px)).toBeCloseTo((PLATE_MAX_W['vec']! / 31.11) * 6.3, 4);
    } finally {
      restore();
    }
  });
});
