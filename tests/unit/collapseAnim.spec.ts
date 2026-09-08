import { describe, expect, it } from 'vitest';
import {
  applyCollapseAnim,
  eventBlockMetrics,
  groupBottomY,
  LANE_HEIGHT,
  rebuildLayout,
  SUMMARY_EVENT_FILL,
} from '../../src/swimlane/layout';
import { CanvasSwimlaneRenderer } from '../../src/swimlane/CanvasSwimlaneRenderer';
import { buildFolderSummaryEvents, findThreadById } from '../../src/domain/swimTree';
import type { SwimlaneModel } from '../../src/domain/types';

/**
 * Card → comm | compute(folder) → core(folder) → mte1, mte2 (leaves) | hbm.
 * Row Y (LANE_HEIGHT=22): card 0(+40) → comm 40 → compute 62 → core 84 →
 * mte1 106 → mte2 128 → hbm 150.
 */
function folderModel(): SwimlaneModel {
  return {
    minTime: 0,
    maxTime: 100,
    processes: [
      {
        id: 'card',
        name: 'Card',
        threads: [
          { id: 'comm', name: 'Comm', events: [] },
          {
            id: 'compute',
            name: 'Compute',
            events: [],
            children: [
              {
                id: 'core',
                name: 'Core',
                events: [],
                children: [
                  { id: 'mte1', name: 'MTE1', events: [{ id: 'e1', name: 'a', startTime: 0, duration: 10 }] },
                  { id: 'mte2', name: 'MTE2', events: [{ id: 'e2', name: 'b', startTime: 10, duration: 10 }] },
                ],
              },
            ],
          },
          { id: 'hbm', name: 'HBM', events: [] },
        ],
      },
    ],
  };
}

describe('applyCollapseAnim (PR-RENDER-027)', () => {
  it('groupBottomY locates the fold just below a folder row', () => {
    const layout = rebuildLayout(folderModel());
    expect(groupBottomY(layout, 'core')).toBe(84 + LANE_HEIGHT);
  });

  it('nested collapse tucks subtree rows into the parent lane (never above it)', () => {
    const layout = rebuildLayout(folderModel());
    const out = applyCollapseAnim(layout, { groupId: 'core', visible: 0, hiddenHeight: 44 });

    const byId = new Map(out.lanes.map((l) => [l.thread.id, l]));
    // Above the folder: unchanged.
    expect(byId.get('comm')!.y).toBe(40);
    expect(byId.get('compute')!.y).toBe(62);
    expect(byId.get('core')!.y).toBe(84);
    // Subtree rows land exactly on the parent lane (84), not above it, and fade out.
    expect(byId.get('mte1')!.y).toBe(84);
    expect(byId.get('mte1')!.alpha).toBe(0);
    expect(byId.get('mte2')!.y).toBe(84);
    expect(byId.get('mte2')!.alpha).toBe(0);
    // The sibling after the subtree closes the gap up to the parent's bottom (106).
    expect(byId.get('hbm')!.y).toBe(106);
    expect(byId.get('hbm')!.alpha).toBeUndefined();
  });

  it('shifts events with their lane and keeps the base layout untouched (pure)', () => {
    const layout = rebuildLayout(folderModel());
    const out = applyCollapseAnim(layout, { groupId: 'core', visible: 0.5, hiddenHeight: 44 });

    const evById = new Map(out.events.map((e) => [e.id, e.y]));
    // mte1 106 → 84 + (106−84)×0.5 = 95; mte2 128 → 84 + (128−84)×0.5 = 106.
    expect(evById.get('e1')).toBe(95);
    expect(evById.get('e2')).toBe(106);

    // Purity: the input layout is not mutated.
    const baseMte1 = layout.lanes.find((l) => l.thread.id === 'mte1')!;
    expect(baseMte1.y).toBe(106);
    expect(baseMte1.alpha).toBeUndefined();
  });

  it('fully expanded (visible = 1) is a no-op', () => {
    const layout = rebuildLayout(folderModel());
    const out = applyCollapseAnim(layout, { groupId: 'core', visible: 1, hiddenHeight: 44 });
    expect(out).toBe(layout);
  });

  it('hitTest / getLayout / eventScreenRect follow the shifted paint Y during the tween', () => {
    const canvas = document.createElement('canvas');
    const renderer = new CanvasSwimlaneRenderer();
    renderer.attach(canvas);
    renderer.setModel(folderModel());
    renderer.resize(200, 400, 1);
    renderer.setView({ startTime: 0, endTime: 100, scrollY: 0 });
    renderer.setCollapseAnim({ groupId: 'core', visible: 0.5, hiddenHeight: 44 });

    // Painted mte1 Y = 95 (see above); hit the event block center there.
    const painted = renderer.eventScreenRect('e1');
    expect(painted).toBeTruthy();
    const m = eventBlockMetrics(95, 0);
    expect(painted!.y).toBeCloseTo(m.y, 5);
    expect(renderer.hitTest(painted!.x + 1, painted!.y + painted!.h / 2)).toBe('e1');

    // Base (unshifted) Y for mte1 is 106 — must not hit there while collapsed mid-tween.
    const baseM = eventBlockMetrics(106, 0);
    expect(renderer.hitTest(painted!.x + 1, baseM.y * 1 + baseM.h / 2)).not.toBe('e1');

    const hitLane = renderer.getLayout().lanes.find((l) => l.thread.id === 'mte1');
    expect(hitLane?.y).toBe(95);
    // Overlay paint input stays on the expanded base (collapse applied separately).
    expect(renderer.getBaseLayout().lanes.find((l) => l.thread.id === 'mte1')?.y).toBe(106);
  });
});

describe('collapse summary dissolve (PR-RENDER-028)', () => {
  it('merges ghost summaries at alpha 1 − visible on the folder lane', () => {
    const model = folderModel();
    const core = findThreadById(model, 'core')!;
    const summaryEvents = buildFolderSummaryEvents(core);
    expect(summaryEvents.length).toBeGreaterThan(0);

    const layout = rebuildLayout(model);
    const mid = applyCollapseAnim(layout, {
      groupId: 'core',
      visible: 0.5,
      hiddenHeight: 44,
      summaryEvents,
    });
    const ghosts = mid.events.filter((e) => e.summary);
    expect(ghosts).toHaveLength(summaryEvents.length);
    expect(ghosts.every((g) => g.alpha === 0.5)).toBe(true);
    expect(ghosts.every((g) => g.y === 84)).toBe(true);
    expect(ghosts.every((g) => g.color === SUMMARY_EVENT_FILL)).toBe(true);

    const open = applyCollapseAnim(layout, {
      groupId: 'core',
      visible: 1,
      hiddenHeight: 44,
      summaryEvents,
    });
    expect(open.events.some((e) => e.summary)).toBe(false);
  });

  it('hit-test prefers ghost summaries when faded children share the folder Y', () => {
    const model = folderModel();
    const summaryEvents = buildFolderSummaryEvents(findThreadById(model, 'core')!);
    const canvas = document.createElement('canvas');
    const renderer = new CanvasSwimlaneRenderer();
    renderer.attach(canvas);
    renderer.setModel(model);
    renderer.resize(200, 400, 1);
    renderer.setView({ startTime: 0, endTime: 100, scrollY: 0 });
    renderer.setCollapseAnim({
      groupId: 'core',
      visible: 0,
      hiddenHeight: 44,
      summaryEvents,
    });

    const ghost = renderer.getLayout().events.find((e) => e.summary);
    expect(ghost).toBeTruthy();
    const rect = renderer.eventScreenRect(ghost!.id);
    expect(rect).toBeTruthy();
    expect(renderer.hitTest(rect!.x + 1, rect!.y + rect!.h / 2)).toBe(ghost!.id);
  });

  it('PR-RENDER-032: ClearType drawEventLabels shifts/fades with collapse tween', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const src = readFileSync(resolve(__dirname, '../../src/swimlane/WebGlSwimlaneRenderer.ts'), 'utf8');
    const draw = src.slice(src.indexOf('private drawEventLabels'), src.indexOf('private drawSolidRect'));
    expect(draw).toMatch(/collapseShiftY\(item\.y,\s*this\.collapse\)/);
    expect(draw).toMatch(/collapseAlpha\(item\.y,\s*this\.collapse\)/);
    expect(draw).toMatch(/labelAlpha\s*<=\s*0/);
  });
});
