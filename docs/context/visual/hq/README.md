# HQ open-questions visuals

Annotated crops for [`HQ_OPEN_QUESTIONS.md`](../../HQ_OPEN_QUESTIONS.md). Each PNG is generated from v930 source frames plus highlight callouts defined in [`manifest.yaml`](./manifest.yaml).

Regenerate after changing source frames or highlight boxes:

```bash
npm run render:hq-visuals
```

Commit the PNGs; CI validates links via `npm run check:design` (does not re-render).
