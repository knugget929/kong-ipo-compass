# Nightly Kong Thesis Steward

The scheduled task researches major Kong developments and writes the public data layer in `knugget929/kong-ipo-compass`.

## Migration gate — read this first

Check `docs/NEWS_STORAGE_MIGRATION.md`.

The split reader is deployed, but the migration remains pre-cutover until PR #1 passes G2 review, is merged, and production split reads are verified. **Continue the existing validated `data/news.json` write behavior during this phase. Do not freeze the monolith merely because the split reader is deployed.**

The narrow-write pattern below becomes authoritative only after `docs/NEWS_STORAGE_MIGRATION.md` is marked `CUT OVER / ACTIVE`.

## Every run after cutover

1. Check Kong primary sources, SEC filing sources, credible financing/market sources, and material competitive developments.
2. Separate confirmed facts from inference and unresolved questions.
3. Decide `UPGRADE`, `MAINTAIN`, or `DOWNGRADE` using the recorded decision rules.
4. Build the intended small-file changes in a validation workspace and run:
   - `node scripts/validate-data.mjs`
   - `node --test scripts/test-news-data.mjs`
5. Commit only the files the run actually changes.

## Exact post-cutover write pattern

### No material news

Update only `data/checks/latest.json`:

- increment its revision;
- set `lastCheckedAt`;
- set run `status`;
- set `thesisDecision`;
- write the concise run summary and optional execution metadata.

Do not touch `data/news/index.json`, any news item file, frozen `data/news.json`, or `data/thesis.json`.

### New material news, thesis unchanged

- create `data/news/items/<stable-id>.json`;
- increment/update `data/news/index.json`, keeping newest first and no more than 30 indexed items;
- increment/update `data/checks/latest.json`;
- leave `data/thesis.json` unchanged.

Prefer one multi-file Git tree commit after validation. If the connected GitHub path only permits sequential writes, create the item file first, then update the index, then the latest-check file. Valid unindexed item files are intentionally safe staged/orphan records.

### New material news that changes the thesis

Use the material-news pattern above and update `data/thesis.json` only when the evidence changes the score, verdict, model defaults/references, catalyst balance, milestones, unknowns, or thesis sources.

Prefer one multi-file Git tree commit. If sequential writes are unavoidable: item file → thesis (if warranted) → index → latest check.

## Guardrails

- Do not modify UI/design files or redeploy the Site for an ordinary data-only run.
- Do not add GitHub Actions.
- Do not add personal holdings or private source material.
- Do not add routine marketing announcements unless they plausibly affect revenue quality, competitive position, IPO readiness, dilution, or valuation.
- Preserve stable IDs and all historical item files.
- Never let the index reference a missing item.
- If permissions fail, sources conflict materially, or candidate JSON validation fails, report the blocker and leave the current valid state unchanged.
- Keep at most 30 material items in the visible index, newest first. Older valid item files may remain as archived evidence.
