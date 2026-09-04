# Open-question visuals

One annotated PNG per open question in [`OPEN_QUESTIONS.md`](../../OPEN_QUESTIONS.md). Each image has **exactly one** highlight box.

Generated from component crops under `src/ui/**/visual/` plus callouts in [`manifest.yaml`](./manifest.yaml).

```bash
npm run render:question-visuals
```

This rewrites `data-1.png`–`data-29.png`, `ui-30.png`–`ui-36.png`, `dimensions.json`, and `<img width height>` tags in [`OPEN_QUESTIONS.md`](../../OPEN_QUESTIONS.md). GitHub markdown stretches bare `![]()` on wide crops; explicit HTML dimensions plus letterboxing (max 4:1) avoids distortion.

Commit the PNGs; CI validates links via `npm run check:design` (does not re-render).
