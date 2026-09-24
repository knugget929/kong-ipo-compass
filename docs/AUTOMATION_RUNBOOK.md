# Nightly Kong Thesis Steward

The scheduled task researches major Kong developments and writes the public data layer in `knugget929/kong-ipo-compass`.

## Authoritative storage contract

The split reader is **CUT OVER / ACTIVE**. Normal scheduled runs must use the narrow-write pattern below.

`data/news.json` is now a frozen compatibility fallback. Do not rewrite it during normal scheduled runs. Do not delete it; retirement remains a separate cleanup after a production soak period.

## Validation tiers

There are two validation tiers.

### Tier A — full repository validation

From a runnable repository checkout, run:

```bash
node scripts/validate-data.mjs
node --test scripts/test-news-data.mjs
```

Tier A remains mandatory for code changes, schema changes, migration changes, validator/test changes, release or deployment work, and structural changes to the news architecture.

### Tier B — connector-safe scheduled-write validation

Ordinary post-cutover scheduled research runs may use the deterministic GitHub-read validation contract in `docs/AUTOMATION_VALIDATION_CONTRACT.md` when the runtime cannot execute Node or materialize a full repository checkout.

Tier B is limited to the three exact routine write patterns documented below. **Lack of Node execution alone is no longer a blocker for a normal split-file scheduled write.** If the candidate falls outside those patterns, or any required validation cannot be completed, commit nothing.

## Every scheduled run

1. Research Kong primary sources, SEC filing sources, credible financing/market sources, and material competitive developments.
2. Separate confirmed facts from inference and unresolved questions.
3. Decide `UPGRADE`, `MAINTAIN`, or `DOWNGRADE` using the recorded decision rules.
4. Build the complete intended small-file candidate changes before writing anything.
5. If a runnable repository checkout exists, Tier A full Node validation may be used.
6. Otherwise apply `docs/AUTOMATION_VALIDATION_CONTRACT.md` Tier B exactly using GitHub reads of the baseline and candidate records.
7. Commit only after the applicable validation passes. Prefer one multi-file Git tree commit; use the documented safe sequential order only when necessary.
8. If validation cannot be completed, commit nothing.

## Exact narrow-write pattern

### No material news

Update only `data/checks/latest.json`:

- increment its revision by exactly one;
- set a valid `lastCheckedAt`;
- set `status` to `NO_MATERIAL_CHANGE`;
- set `thesisDecision`;
- write the concise run summary and optional execution metadata.

Do not touch `data/news/index.json`, any news item file, frozen `data/news.json`, `data/thesis.json`, or `dist/data/*`.

### New material news, thesis unchanged

- create one new `data/news/items/<stable-id>.json` at revision 1;
- increment/update `data/news/index.json`, keeping newest first and no more than its unchanged `historyLimit` (currently 30);
- increment/update `data/checks/latest.json` with `status: "MATERIAL_CHANGE"`;
- leave `data/thesis.json` unchanged;
- leave frozen `data/news.json` and `dist/data/*` unchanged.

Prefer one multi-file Git tree commit after validation. If the connected GitHub path only permits sequential writes, create the item file first, then update the index, then the latest-check file. Valid unindexed item files are intentionally safe staged/orphan records.

### New material news that changes the thesis

Use the material-news pattern above and update `data/thesis.json` only when the newly recorded evidence changes the score, verdict, model defaults/references, catalyst balance, milestones, unknowns, or thesis sources.

The candidate thesis must satisfy the evidence-link and transition requirements in `docs/AUTOMATION_VALIDATION_CONTRACT.md`.

Prefer one multi-file Git tree commit. If sequential writes are unavoidable: item file -> thesis -> index -> latest check. Leave frozen `data/news.json` and `dist/data/*` unchanged.

## Guardrails

- Do not modify UI/design files or redeploy the Site for an ordinary data-only run.
- Do not add GitHub Actions.
- Do not add personal holdings, credentials, private messages, or private research.
- Do not add routine marketing announcements unless they plausibly affect revenue quality, competitive position, IPO readiness, dilution, or valuation.
- Preserve stable IDs and all historical item files.
- Never let the index reference a missing item.
- A valid unindexed item is a safe staged/orphan record and must not be deleted merely because it is unindexed.
- Never rewrite frozen `data/news.json` or `dist/data/*` during a routine scheduled run.
- Never update `data/thesis.json` without newly recorded material evidence that supports the change.
- If permissions fail, sources conflict materially, the baseline changes during candidate validation/write, or candidate validation fails, report the blocker and leave the current valid state unchanged.
- Keep at most 30 material items in the visible index, newest first. Older valid item files may remain as archived evidence.
