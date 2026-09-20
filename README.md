# Kong IPO Compass

An interactive, evidence-labeled Kong Inc. IPO thesis and valuation scenario model.

## Product surface

- Adjustable ARR, ARR multiple, net cash, fully diluted shares, and IPO pricing discount
- Bear, base, and bull presets plus an ARR/multiple sensitivity table
- Personal share count, cost basis, modeled value, gain, and multiple-on-cost
- Evidence-weighted thesis score, catalysts, risks, upgrade/downgrade rules, milestones, unknowns, and primary sources
- Major-news feed with confirmed facts, unresolved questions, source links, and explicit thesis impact
- Device-local scenario persistence; no personal holdings data is transmitted

## Live data architecture

The new Site reader is designed to fetch these small canonical records from `knugget929/kong-ipo-compass` whenever it opens:

- `data/thesis.json` — verdict, score, valuation defaults/presets, catalysts, milestones, unknowns, and sources
- `data/checks/latest.json` — latest scheduled-run status and summary
- `data/news/index.json` — ordered visible material-news IDs and minimal listing metadata
- `data/news/items/<stable-id>.json` — one material development per file

Migration is currently **pre-cutover**: `data/news.json` must continue to be updated until the new `dist/app.js` reader is deployed to the production Site and verified. After that one-time reader deployment, normal nightly runs update only the small files they actually change and `data/news.json` becomes a frozen compatibility fallback. See `docs/NEWS_STORAGE_MIGRATION.md`. `dist/data/*` remain deploy-time fallback snapshots.

Personal share count, cost basis, and custom scenario values are never written to GitHub; they remain in browser storage on the user's device.

## Direct validation

This project intentionally uses an Actions-free, LOW_AGENTIC_USAGE workflow. Validate locally:

```bash
node --check dist/app.js
node scripts/validate-data.mjs
node --test scripts/test-news-data.mjs
python3 -m json.tool dist/data/thesis.json >/dev/null
node scripts/validate-project-state.mjs
```

The hosted static entrypoint is `dist/index.html`.