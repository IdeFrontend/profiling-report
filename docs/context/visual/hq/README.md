# HQ open-questions visuals

Annotated crops for [`HQ_OPEN_QUESTIONS.md`](../../HQ_OPEN_QUESTIONS.md). Each PNG is generated from component crops under `src/ui/**/visual/` (preferred) or v930 source frames, plus highlight callouts in [`manifest.yaml`](./manifest.yaml).

Regenerate after changing source frames or highlight boxes:

```bash
npm run render:hq-visuals
```

This rewrites the PNGs, `dimensions.json`, and `<img width height>` tags in [`HQ_OPEN_QUESTIONS.md`](../../HQ_OPEN_QUESTIONS.md). GitHub markdown stretches bare `![]()` on wide crops; explicit HTML dimensions plus letterboxing (max 4:1) avoids distortion.

Commit the PNGs; CI validates links via `npm run check:design` (does not re-render).
