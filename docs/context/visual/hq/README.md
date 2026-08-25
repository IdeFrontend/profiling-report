# HQ open-questions visuals

One annotated PNG per question in [`HQ_OPEN_QUESTIONS.md`](../../HQ_OPEN_QUESTIONS.md). Each image has **exactly one** highlight box.

Generated from component crops under `src/ui/**/visual/` plus callouts in [`manifest.yaml`](./manifest.yaml).

```bash
npm run render:hq-visuals
```

This rewrites `q1.png`–`q37.png`, `dimensions.json`, and `<img width height>` tags in [`HQ_OPEN_QUESTIONS.md`](../../HQ_OPEN_QUESTIONS.md). GitHub markdown stretches bare `![]()` on wide crops; explicit HTML dimensions plus letterboxing (max 4:1) avoids distortion.

Commit the PNGs; CI validates links via `npm run check:design` (does not re-render).
