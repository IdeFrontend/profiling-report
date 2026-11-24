import type { Baseline } from './baselinesModel';

/**
 * Display-title derivation for 对比基线 entries (review PR #234): a baseline
 * whose host name is a GENERATED id (an OPPROF run id, a uuid, the library's
 * own `b-…` fallback, or nothing) is titled by its report **filename + the
 * pick timestamp** instead — the boilerplate id never surfaces as the title.
 *
 * A real host name (MSTT's record title) passes through, with the timestamp
 * appended when one is known.
 */

/** OPPROF run ids the MSTT tree titles runs with: `OPPROF_YYYYMMDDHHMMSS_<8+ uppercase letters>`. */
const OPPROF_RUN_ID_RE = /^OPPROF_\d{14}_[A-Z]{8,}$/;
/** The library's own `newBaselineId()` shapes: uuid v4 (secure context) or `b-<8+ char ts36>-<8 char rand>`. */
const GENERATED_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Anchored to `newBaselineId`'s fixed widths, so human names (`b-matmul-7x7`, `b-run-1`) stay unmatched. */
const FALLBACK_ID_RE = /^b-[0-9a-z]{8,}-[0-9a-z]{8}$/;

/** True when the name carries no human information and must be replaced by the derived title. */
export function isGeneratedBaselineName(name: string | undefined): boolean {
  if (!name || !name.trim()) return true;
  const n = name.trim();
  return OPPROF_RUN_ID_RE.test(n) || GENERATED_ID_RE.test(n) || FALLBACK_ID_RE.test(n);
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** "YYYY-MM-DD HH:mm" — the locale-neutral numeric stamp both locales read the same way.
 *  Empty for anything that is not a REAL positive instant: NaN, Infinity, 0 (the
 *  unknown-mtime sentinel) and negative values. */
export function formatBaselineStamp(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const d = new Date(ms);
  // ms ≤ 8.64e15 is the Date range; a finite value beyond it (9e15) is an
  // Invalid Date whose getters print "NaN-NaN-NaN NaN:NaN".
  if (Number.isNaN(d.getTime())) return '';
  return (
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ` +
    `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  );
}

interface OpprofClock {
  y: number;
  mo: number;
  d: number;
  h: number;
  mi: number;
  s: number;
}

/**
 * Digits of `OPPROF_YYYYMMDDHHMMSS_…`. Undefined when they are not a real
 * calendar time (Feb 31, month 13, hour 24). UTC getters reject `Date`
 * normalization without involving the local timezone.
 */
function opprofClock(name: string | undefined): OpprofClock | undefined {
  const m = /^OPPROF_(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})_/.exec(name ?? '');
  if (!m) return undefined;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const h = Number(m[4]);
  const mi = Number(m[5]);
  const s = Number(m[6]);
  const utc = new Date(Date.UTC(y, mo - 1, d, h, mi, s));
  if (
    utc.getUTCFullYear() !== y
    || utc.getUTCMonth() !== mo - 1
    || utc.getUTCDate() !== d
    || utc.getUTCHours() !== h
    || utc.getUTCMinutes() !== mi
    || utc.getUTCSeconds() !== s
  ) return undefined;
  return { y, mo, d, h, mi, s };
}

/** "YYYY-MM-DD HH:mm" from the embedded digits. Empty when the clock is not real. */
function opprofStampText(name: string | undefined): string {
  const p = opprofClock(name);
  if (!p) return '';
  return `${p.y}-${pad2(p.mo)}-${pad2(p.d)} ${pad2(p.h)}:${pad2(p.mi)}`;
}

/**
 * Local epoch of an OPPROF run id, when those digits are a real local time.
 * A spring-forward gap is a real calendar time but not a local instant, so
 * this returns undefined. An AMBIGUOUS local time (the autumn overlap, e.g.
 * `2026-10-25 01:30` in Europe/London) is implementation-defined per
 * ECMA-262 — consumers must not compare the returned epoch across engines.
 * The TITLE does not call this helper: it derives its stamp from
 * `opprofStampText` (the digits themselves), never from a round-tripped
 * epoch.
 */
export function stampFromOpprofName(name: string | undefined): number | undefined {
  const p = opprofClock(name);
  if (!p) return undefined;
  const d = new Date(p.y, p.mo - 1, p.d, p.h, p.mi, p.s);
  if (
    d.getFullYear() !== p.y
    || d.getMonth() !== p.mo - 1
    || d.getDate() !== p.d
    || d.getHours() !== p.h
    || d.getMinutes() !== p.mi
    || d.getSeconds() !== p.s
  ) return undefined;
  return d.getTime();
}

function basenameOf(path: string): string {
  const base = path.split(/[\\/]/).filter((seg) => seg.length > 0).pop() ?? '';
  return base.trim();
}

/**
 * The title shown in the picker rows and the aside Baseline dropdown:
 *
 * - a REAL host name (not a generated id) → the name, plus the timestamp when known;
 * - a generated / missing name → `filename + timestamp` — the report filename
 *   from `path`, unless that filename (with or without its extension) is
 *   itself generated (then the timestamp alone, read from its embedded stamp);
 * - no timestamp anywhere → the name, then the filename. The generated id
 *   NEVER surfaces as a title. Nothing derivable at all → the EMPTY string:
 *   hosts may substitute their own localized "unnamed" placeholder.
 *
 * `pickedAt` (epoch ms) wins over `baseline.pickedAt`, which wins over the
 * stamp parsed from an OPPROF name — but only an instant that FORMATS counts:
 * a broken, sentinel (NaN, 0 = unknown mtime) or out-of-Date-range value
 * falls to the NEXT source instead of shadowing it, so neither a sentinel
 * explicit argument nor an `mtimeNs`-as-ms mix-up short-circuits a valid
 * entry stamp or the embedded digits.
 */
export function baselineDisplayTitle(baseline: Baseline, pickedAt?: number): string {
  const name = baseline.name?.trim() ?? '';
  const filename = basenameOf(baseline.path);
  // Generated filenames keep their extension (`.rep`, `.npu-rep`), while the
  // id regexes are end-anchored — judge the extensionless stem too.
  const filenameStem = filename.replace(/\.[^.]+$/, '');
  const generatedName = isGeneratedBaselineName(name);
  // Resolve the sentinel BEFORE choosing the source: an unknown explicit
  // argument is not a pick — the entry stamp still has its turn.
  const valid = (ms: number | undefined): ms is number =>
    ms != null && Number.isFinite(ms) && ms > 0;
  // Format each candidate FIRST: a positive-but-out-of-range instant (beyond
  // the Date range) is finite and passes `valid`, but formats '' — it must
  // fall to the NEXT source, not shadow the entry stamp or the digits.
  const explicitStamp = valid(pickedAt) ? formatBaselineStamp(pickedAt) : '';
  const entryStamp = valid(baseline.pickedAt) ? formatBaselineStamp(baseline.pickedAt) : '';
  // A host instant formats in local time. An embedded OPPROF clock is the
  // digits themselves — round-tripping those through Date rolls Feb 31 and
  // DST gaps.
  const stamp = explicitStamp || entryStamp || opprofStampText(name) || opprofStampText(filename);
  if (!generatedName) return stamp ? `${name} ${stamp}` : name;
  // The generated id is replaced: filename + stamp, or just the stamp when the
  // filename is itself an autogenerated run id (an MSTT run directory).
  const base = isGeneratedBaselineName(filename) || isGeneratedBaselineName(filenameStem)
    ? ''
    : filename;
  // `name` here is ALWAYS generated (non-generated names returned above), so
  // returning it would surface the boilerplate id the doc forbids — and a
  // generated filename was already blanked into `base`. Empty = "unnamed".
  if (!base && !stamp) return '';
  return [base, stamp].filter(Boolean).join(' ');
}
