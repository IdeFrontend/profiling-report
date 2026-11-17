# Source freshness (objdump vs workspace)

| | |
|--|--|
| **Status** | **Product-final** — [DATA-57](../context/decisions/DATA.md#data-57) |
| **Not** | A new leaf embed, SHA catalog, or packed full-source archive |
| **Input** | Existing [`objdump.txt`](compute/objdump.txt.md) interleaved source annotations + matched local file bytes |
| **Lookup** | Host / workspace file resolve (Kirill Aleshin) — **do not** reimplement a parallel lookup |

Normative keywords: **MUST** / **MUST NOT** / **SHOULD** / **MAY** (RFC 2119 sense).

---

## 1. Decision

Neither **npu-compute** nor **emulate** packs provide reliable **full source files** or **content SHA** for “did the workspace change since this report?”.

Therefore:

| Approach | Verdict |
|----------|---------|
| Optional `sources.json` digests / embedded source FileInfos | **MUST NOT** ship as product format for this purpose |
| Compare interleaved source text in [`objdump.txt`](compute/objdump.txt.md) to matched local file content | **MUST** be the freshness check |
| Warning when matched lines differ | **MUST** surface in Source UI (does **not** hide the tab) |
| Host file lookup | **MUST** reuse Kirill Aleshin’s lookup / existing `resolveSourceFile` path — **MUST NOT** duplicate |

---

## 2. What `objdump.txt` carries

Producer-style listings (llvm-objdump-like, often with source interleave) include:

- Sparse `path:line` annotations (often absolute build paths)
- Optional **source text lines** interleaved between instruction rows

Example (trimmed from gather_2d):

```text
/home/…/gather_2d/gather_2d.asc:25
{
       0:				02004880	MOV		X0, PARA_BASE
```

The instruction parser keeps PC + mnemonic rows; freshness logic **MAY** also parse path:line markers and adjacent non-instruction source lines. See [objdump.txt.md](compute/objdump.txt.md).

**Limits (accepted):**

- Only lines that appear at asm / interleave boundaries are checkable — not a full-file digest
- No annotation for a path → freshness **unknown** for that file (not mismatch)
- Path alone without interleaved source text is insufficient to prove content identity

---

## 3. Compare flow

1. **Match** report source paths (symbolizer `FileName` / objdump path annotations) to workspace files via the **existing host lookup** (Kirill / `resolveSourceFile`) — no second resolver.
2. **Extract** checkable snippets from `objdump.txt` (path + 1-based line + interleaved text when present).
3. **Compare** each snippet to the corresponding line(s) of the matched local file (byte-oriented line text after the host’s normal open; no inventing SHA embeds).
4. **Aggregate** per file (and optionally per report): `match` | `mismatch` | `unknown`.
5. **UI:** on any `mismatch`, show a **warning** that local sources differ from the report’s objdump view. Source correlation / SASS panes stay available.

Missing local file → `unknown` (or existing missing-source placeholder), not a false mismatch.

---

## 4. Profiles

| Profile | Freshness input | Notes |
|---------|-----------------|-------|
| compute | [`objdump.txt`](compute/objdump.txt.md) | Primary path |
| emulate | No product SHA / full-source pack for this check | Do **not** invent compute-shaped `sources.json`; emulate Source fill remains [DATA-53](../context/questions/DATA.md) / ELF tables |

---

## 5. Out of scope

- New FileInfo types, `sources.json`, or packed obfuscated source trees for fingerprinting
- Cryptographic authenticity / signatures
- Replacing optional pack embeds (`.asc` / `.cpp` / `.h`) used only to fill the left pane when present ([symbolizer source-text](compute/symbolizer.json.md#source-text))

---

## Related

- Decision: [DATA-57](../context/decisions/DATA.md#data-57)
- View: [source](../views/source.md)
- Spec: [source-provenance.spec.md](../../specs/core/source-provenance.spec.md)
- Host resolve: [MSTT_INTEGRATION](../architecture/MSTT_INTEGRATION.md) § `resolveSourceFile`
