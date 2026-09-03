# Kong IPO Compass Data Architecture

## Outcome

The ChatGPT Site is a stable presentation shell. It loads current thesis and major-news records from public GitHub at runtime, so ordinary research updates require a JSON commit—not a rebuild or redeploy.

## Canonical records

| File | Owns | Updated when |
| --- | --- | --- |
| `data/thesis.json` | Verdict, score, valuation defaults/presets, scorecard, catalysts, milestones, decision rules, unknowns, sources, change log | Material evidence changes the thesis, or a model input/reference is deliberately revised |
| `data/news.json` | Latest check status, summary, and material news ledger | Every scheduled check updates `lastCheckedAt`; only material items are added |
| `dist/data/*.json` | Deploy-time fallback snapshot | Only when the Site shell itself is released |

The browser tries raw GitHub first with cache disabled and a six-second timeout. It falls back independently to the deployed snapshot and finally to a small embedded baseline. The header identifies `Live · GitHub` or `Snapshot · GitHub unavailable`.

## Privacy boundary

Canonical files are public. They must never contain personal holdings, cost basis, credentials, private messages, or unredacted private research. Personal inputs and custom scenarios are stored only in the browser's local storage.

## Change contract

- Preserve `schemaVersion: 1` until the Site shell can read a newer schema.
- Increment `revision` for every changed canonical file.
- Use ISO 8601 timestamps and stable news item IDs.
- Use only `UPGRADE`, `MAINTAIN`, or `DOWNGRADE` for thesis decisions.
- Cite every material news item with at least one direct source.
- Keep confirmed facts and remaining uncertainty in separate arrays.
- Never infer an IPO filing, ARR, share count, secondary price, or financial metric from narrative signals.
- Run `node scripts/validate-data.mjs` before committing.

## Failure behavior

A failed research run leaves the last valid canonical record untouched and reports the blocker. A temporary GitHub read failure does not break the dashboard because the deployed snapshot remains available. A schema validation failure must not be committed.