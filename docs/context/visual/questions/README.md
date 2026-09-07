# Open-question visuals

One annotated PNG per open question in [`questions/`](../../questions/). Each image has **exactly one** highlight box.

Generated from component crops under `src/ui/**/visual/` plus callouts in [`manifest.yaml`](./manifest.yaml).

```bash
npm run render:question-visuals
```

This rewrites PNGs listed in [`manifest.yaml`](./manifest.yaml) (open questions that still have design crops), `dimensions.json`, and `<img width height>` tags in [`questions/`](../../questions/). Resolved ids have no crops here — see [DEVELOPMENT.md § Resolving open questions](../../../process/DEVELOPMENT.md#resolving-open-questions). GitHub markdown stretches bare `![]()` on wide crops; explicit HTML dimensions plus letterboxing (max 4:1) avoids distortion.

Commit the PNGs; CI validates links via `npm run check:design` (does not re-render).
