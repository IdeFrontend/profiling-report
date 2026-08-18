/**
 * Synthetic dependency demo (interim I-Q9): `out.rep` and `out.trace.json` carry
 * no edges, so the Relevent column has nothing to show on the real fixtures.
 * Chain mirrors `v930/task-click-detail`: two ProfilerStep predecessors, the
 * selected MOV_OUT task, two ProfilerStep successors.
 */
import type { ChromeTraceEvent } from '../src/adapters/chromeTraceToSwimlane';

function task(
  tid: number,
  name: string,
  ts: number,
  dur: number,
  eventId: string,
  dependencies?: string[],
  extra?: Record<string, unknown>,
): ChromeTraceEvent {
  return {
    ph: 'X',
    name,
    pid: 1,
    tid,
    ts,
    dur,
    args: { event_id: eventId, ...(dependencies ? { dependencies } : {}), ...extra },
  };
}

export function depsTraceFixture(): { displayTimeUnit: string; traceEvents: ChromeTraceEvent[] } {
  return {
    displayTimeUnit: 'ns',
    traceEvents: [
      { ph: 'M', name: 'process_name', pid: 1, tid: 0, args: { name: 'Card0' } },
      { ph: 'M', name: 'thread_name', pid: 1, tid: 1, args: { name: 'Core0.Cube/SCALAR' } },
      { ph: 'M', name: 'thread_name', pid: 1, tid: 2, args: { name: 'Core0.Cube/MTE2' } },
      { ph: 'M', name: 'thread_name', pid: 1, tid: 3, args: { name: 'Core0.Vec0/ALL' } },

      task(1, 'ProfilerStep#1', 0, 1_200, 'step-1', ['mov-out']),
      task(1, 'ProfilerStep#2', 1_400, 900, 'step-2', ['mov-out']),

      task(2, 'MOV_OUT_TO_L1_MULTI_ND2NZ', 2_600, 974, 'mov-out', ['step-17', 'step-18'], {
        op_type: 'MOV_OUT_TO_L1_MULTI_ND2NZ',
        Code: [
          '/usr/local/Ascend/ascend-toolkit/latest/tools/tikcpp/tikcfw/impl/dav_c220000000/kernel_operator_mov.h',
          '/usr/local/Ascend/ascend-toolkit/latest/tools/tikcpp/tikcfw/lib/matmul/impl/matmul_impl.h',
        ],
        Pc_addr: '0xf00103da',
        Process_bytes: 4096,
      }),

      task(2, 'FIX_LOC_TO_DST', 3_800, 640, 'fix-loc', ['step-18'], {
        op_type: 'FIX_LOC_TO_DST',
        Pc_addr: '0xf011027e',
      }),

      task(3, 'ProfilerStep#17', 4_600, 1_500, 'step-17'),
      task(3, 'ProfilerStep#18', 6_300, 1_100, 'step-18'),
    ],
  };
}
