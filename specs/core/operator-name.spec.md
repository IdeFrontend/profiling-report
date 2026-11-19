# operatorName

| spec-id-prefix |
|----------------|
| PR-OPN-*       |

Pure display helper: reduce a compiler symbol to the short operator name.

## Inputs

- **name** — optional raw operator name or demangled signature.

## Behavior

Trims the input. Cuts at the first `<` (template arguments), then at the first `(` (parameters), then keeps the last space-separated token so a leading return type (`void `) is dropped. Blank input returns `undefined`.

## Acceptance Criteria

1. **PR-OPN-001** — Short name strips types and params.

## Changelog

- **2026-11-12** — Initial spec.
