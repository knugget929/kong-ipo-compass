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

The stable Site shell fetches two public files from `knugget929/kong-ipo-compass` whenever it opens:

- `data/thesis.json` — verdict, score, valuation defaults/presets, catalysts, milestones, unknowns, and sources
- `data/news.json` — latest research check plus material developments and their thesis impact

The nightly Kong task updates those files directly. The Site therefore reflects new research without rebuilding or redeploying. `dist/data/*` are resilient fallback snapshots used only when GitHub cannot be reached.

Personal share count, cost basis, and custom scenario values are never written to GitHub; they remain in browser storage on the user's device.

## Direct validation

This project intentionally uses an Actions-free, LOW_AGENTIC_USAGE workflow. Validate locally:

```bash
node --check dist/app.js
node scripts/validate-data.mjs
python3 -m json.tool dist/data/thesis.json >/dev/null
node scripts/validate-project-state.mjs
```

The hosted static entrypoint is `dist/index.html`.