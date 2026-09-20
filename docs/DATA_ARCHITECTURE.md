# Kong IPO Compass Data Architecture

## Outcome

The target architecture splits research state into small GitHub records so scheduled runs can validate and write only the files that actually changed. The migration is backward-safe: the legacy monolith remains available until the split reader has been deployed and verified in production.

**Cutover status:** `READY_FOR_READER_DEPLOY`. See `docs/NEWS_STORAGE_MIGRATION.md`. Until that activation gate is satisfied, production automation must continue updating `data/news.json` for the currently deployed old reader.

## Target canonical records after cutover

| File | Owns | Updated when |
| --- | --- | --- |
| `data/thesis.json` | Verdict, score, valuation defaults/presets, scorecard, catalysts, milestones, decision rules, unknowns, sources, change log | Material evidence changes the thesis or a model input/reference is deliberately revised |
| `data/checks/latest.json` | Latest run timestamp, status, thesis decision, concise summary, optional execution/error metadata | Every scheduled check |
| `data/news/index.json` | Ordered material-news IDs plus minimal listing metadata, schema version, revision, and history limit | The visible material-news history changes |
| `data/news/items/<stable-id>.json` | One material development: sources, confirmed facts, uncertainty, significance, score delta, thesis decision, timestamps | A new material item is added or an existing item is explicitly corrected |
| `data/news.json` | Legacy compatibility record during migration; frozen compatibility snapshot only after cutover | Continue updating pre-cutover; do not update during normal post-cutover runs |
| `dist/data/*.json` | Deploy-time fallback snapshots | Only when the Site shell itself is released |

The new browser reader first loads the split live records from raw GitHub. It fetches `checks/latest.json` and `news/index.json`, then loads only the indexed item files. If the split path is unavailable or incomplete, it falls back to the legacy live `data/news.json`, then the deployed snapshot, then the embedded baseline.

## News history and orphan items

`data/news/index.json` caps the visible history at `historyLimit` (currently 30). Item files are intentionally durable. A valid item file that is not listed in the index is treated as archived or staged data, not as a rendering error. This supports two safety properties:

- older history can leave the visible window without deleting evidence;
- a new item file can be written before the index references it, so an interrupted sequential write does not break the live reader.

An index entry that references a missing item is invalid and must never be committed.

## Change contract

- Preserve `schemaVersion: 1` until the Site shell can read a newer schema.
- Increment the revision of each changed mutable record. Item files begin at revision 1 and advance only when that item is deliberately corrected.
- Use ISO 8601 timestamps and stable news IDs/filenames.
- Use only `UPGRADE`, `MAINTAIN`, or `DOWNGRADE` for thesis decisions.
- Use only `high`, `meaningful`, or `noted` for significance.
- Cite every material item with at least one HTTPS source.
- Keep confirmed facts and remaining uncertainty in separate arrays.
- Keep the index newest-first and at or below its declared history limit.
- Never infer an IPO filing, ARR, share count, secondary price, or financial metric from narrative signals.
- Run `node scripts/validate-data.mjs` and `node --test scripts/test-news-data.mjs` before committing.

The validator checks duplicate IDs, missing indexed items, valid staged/archived orphans, index/item metadata agreement, source/significance rules, history limits, legacy migration fidelity, thesis/snapshot validity, and privacy constraints.

## Post-cutover automation write patterns

These narrow-write patterns become authoritative only after the activation gate in `docs/NEWS_STORAGE_MIGRATION.md` is satisfied.

**No-news run**

1. Build and validate the candidate `data/checks/latest.json`.
2. Update only `data/checks/latest.json`.
3. Leave the news index, all news item files, frozen legacy `data/news.json`, and thesis untouched.

**Material news with no thesis change**

1. Build the new item file, updated index, and updated latest-check record in the validation workspace.
2. Validate the complete candidate state.
3. Prefer one Git tree commit containing the small changed files.
4. If the connector can only make sequential writes: create the item file first, then update the index, then update the latest check. The orphan-tolerant validator makes the first step safe.
5. Leave `data/thesis.json` untouched.

**Material news with a thesis change**

Follow the same pattern, adding `data/thesis.json` only when evidence warrants a thesis/model change. Prefer one multi-file Git commit; if sequential writes are unavoidable, write the item first, thesis second, index third, and latest-check record last.

## Privacy boundary

Canonical files must never contain personal holdings, cost basis, credentials, private messages, or unredacted private research. Personal inputs and custom scenarios remain browser-local.

## Failure behavior

A failed research run does not rewrite history. If candidate validation fails, commit nothing. If a sequential post-cutover run stops after writing only a new unindexed item, the Site ignores that staged orphan and remains valid. A temporary GitHub read failure does not break the dashboard because legacy and deployed fallback paths remain available.
