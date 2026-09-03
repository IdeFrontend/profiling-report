import { describe, expect, it } from 'vitest';
import {
  applyCollapseAnim,
  groupBottomY,
  LANE_HEIGHT,
  rebuildLayout,
} from '../../src/swimlane/layout';
import type { SwimlaneModel } from '../../src/domain/types';

/** Card → comm | compute(folder) → core(folder) → mte1, mte2 (leaves). */
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
        ],
      },
    ],
  };
}

describe('applyCollapseAnim (PR-RENDER-023)', () => {
  it('groupBottomY locates the first descendant row below a folder header', () => {
    const layout = rebuildLayout(folderModel());
    // card y0 (+40) → comm 40 → compute 62 → core 84 → mte1 106 → mte2 128
    expect(groupBottomY(layout, 'core')).toBe(84 + LANE_HEIGHT);
  });

  it('fully collapsed: subtree lanes shift up by hiddenHeight and fade to 0', () => {
    const layout = rebuildLayout(folderModel());
    const out = applyCollapseAnim(layout, { groupId: 'core', visible: 0, hiddenHeight: 44 });

    const byId = new Map(out.lanes.map((l) => [l.thread.id, l]));
    // Above the folder: unchanged.
    expect(byId.get('comm')!.y).toBe(40);
    expect(byId.get('compute')!.y).toBe(62);
    expect(byId.get('core')!.y).toBe(84);
    // Subtree slides up under the header (106→62, 128→84) and fades out.
    expect(byId.get('mte1')!.y).toBe(62);
    expect(byId.get('mte1')!.alpha).toBe(0);
    expect(byId.get('mte2')!.y).toBe(84);
    expect(byId.get('mte2')!.alpha).toBe(0);
  });

  it('shifts events with their lane and keeps the base layout untouched (pure)', () => {
    const layout = rebuildLayout(folderModel());
    const out = applyCollapseAnim(layout, { groupId: 'core', visible: 0.5, hiddenHeight: 44 });

    const evById = new Map(out.events.map((e) => [e.id, e.y]));
    expect(evById.get('e1')).toBe(106 - 22);
    expect(evById.get('e2')).toBe(128 - 22);

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
});
