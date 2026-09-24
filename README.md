# Kong IPO Compass + GME Short Squeeze Watch

One ChatGPT Site hosts two independent thesis Watches:

- `/kong` — the existing evidence-labeled Kong Inc. IPO thesis and valuation scenario model;
- `/gme` — an evidence-gated monitor of the mechanisms required for a nonlinear GME short squeeze.

The root route continues to serve Kong for backward compatibility.

## Product surface

### Kong

- Adjustable ARR, ARR multiple, net cash, fully diluted shares, and IPO pricing discount
- Bear, base, and bull presets plus an ARR/multiple sensitivity table
- Personal share count, cost basis, modeled value, gain, and multiple-on-cost
- Evidence-weighted thesis score, catalysts, risks, upgrade/downgrade rules, milestones, unknowns, and primary sources
- Major-news feed with confirmed facts, unresolved questions, source links, and explicit thesis impact
- Device-local scenario persistence; no personal holdings data is transmitted

### GME

- Six interacting engines: short, borrow, options, market, catalyst, and supply/dilution
- Deterministic Dormant → Attention → Pressure → Reflexive → Squeeze → Dislocation state gates
- What changed, competing explanations, next-state conditions, and falsifiers
- Options concentration, capital structure, source freshness, catalyst map, and reconstructable history
- Explicit observed/derived/inferred/unknown boundaries; no numerical squeeze score

## Live data architecture

The new Site reader is designed to fetch these small canonical records from `knugget929/kong-ipo-compass` whenever it opens:

- `data/thesis.json` — verdict, score, valuation defaults/presets, catalysts, milestones, unknowns, and sources
- `data/checks/latest.json` — latest scheduled-run status and summary
- `data/news/index.json` — ordered visible material-news IDs and minimal listing metadata
- `data/news/items/<stable-id>.json` — one material development per file

Kong's split-data cutover is complete. `data/news.json` is a frozen compatibility fallback; normal checks update the split records. See `docs/NEWS_STORAGE_MIGRATION.md`. `dist/data/*` remain deploy-time fallback snapshots.

GME canonical records live in `data/gme/`. The Site reads `current.json` and history at run time, with `dist/data/gme/` as a safe deployment snapshot.

Personal share count, cost basis, and custom scenario values are never written to GitHub; they remain in browser storage on the user's device.

## Direct validation

This project intentionally uses an Actions-free, LOW_AGENTIC_USAGE workflow. Validate locally:

```bash
node --check dist/app.js
node --check dist/gme/gme.js
node scripts/validate-data.mjs
node scripts/validate-gme-data.mjs
node scripts/validate-site.mjs
node --test scripts/test-news-data.mjs scripts/test-gme-state-engine.mjs scripts/test-gme-observations.mjs
python3 -m json.tool dist/data/thesis.json >/dev/null
node scripts/validate-project-state.mjs
```

The hosted static entrypoints are `dist/index.html`, `dist/kong/index.html`, and `dist/gme/index.html`.
