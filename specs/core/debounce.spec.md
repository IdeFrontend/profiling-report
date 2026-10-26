# Debounce

| spec-id-prefix |
|----------------|
| PR-DEBOUNCE-*  |

Cooldown-style (leading-edge) debounce wrapper for UI triggers that must answer the first call immediately but swallow rapid repeat calls (misfired double-clicks).

```ts
debounce(fn, waitMs): (...args) => void
```

## Behavior

**Leading edge.** The returned wrapper invokes `fn` synchronously on its first call (arguments forwarded) and records the fire time. Calls inside the `waitMs` window after a fire return without invoking `fn` — swallowed silently: no error, no queuing, no trailing fire. The first call after the window fires again immediately.

**Window anchored at the last fire, not the last attempt.** Swallowed calls never extend the cooldown: a burst of clicks cannot keep the trigger locked forever — it reopens exactly `waitMs` after the last actual fire, even while attempts keep arriving. This is the deliberate difference from classic trailing debounce (which waits for silence before firing); the trade is that the *last* attempt inside a window is dropped, which is the wanted behavior for misoperation guards (the cannbot section icons' 1s emit cooldown, `PR-ROOT-008`).

**Per-wrapper state.** Each `debounce()` call creates an independent closure — two wrappers never share a window, and each component instance that builds one in `setup` gets its own. The time source is `Date.now()` (fake-timer friendly: `vi.useFakeTimers()` + `vi.advanceTimersByTime` drive it in tests).

## Acceptance Criteria

1. **PR-DEBOUNCE-001** — First call fires `fn` immediately with its arguments; calls within `waitMs` are swallowed; the first call after the window fires again.
1. **PR-DEBOUNCE-002** — Swallowed calls do not extend the window (anchored at the last fire, not the last attempt): a call at `waitMs − 1` is swallowed, and a call at `waitMs + 1` fires even though attempts never stopped.
1. **PR-DEBOUNCE-003** — Each `debounce()` wrapper owns its cooldown independently; two wrappers can both fire at the same timestamp.

## Edge Cases

- `waitMs` `0` → every call fires (no cooldown).
- No `this` binding — closure / arrow call sites only.

## Dependencies

Consumer: [ProfilingReport](../../src/ui/ProfilingReport/ProfilingReport.spec.md) — the cannbot icon emit cooldown (`PR-ROOT-008`).

## Changelog
- **2026-10-19** — Initial spec; extracted from the inline cannbot emit lock in ProfilingReport (`PR-ROOT-008`).
