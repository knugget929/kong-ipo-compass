# GME Watch operations

## Storage and production

Canonical live records are `data/gme/*` on `main`: current.json (latest valid evidence), health.json (latest attempt), history/YYYY-MM-DD.json (immutable daily snapshots), history/index.json, events/items/<stable-id>.json (immutable material events), and events/index.json. The Site reads `https://raw.githubusercontent.com/knugget929/kong-ipo-compass/main/data/gme` first. `dist/data/gme/*` is an independently valid deployment-time fallback only. Routine updates never copy canonical records into dist, rebuild or deploy. The existing `/kong` split reader and `/gme` visual design remain intact.

A single release deploys the main-source reader. After that, reload `/gme` to retrieve current GitHub records; the observed and checked timestamps distinguish evidence age from the most recent attempt. A failed provider preserves old evidence and ages naturally. Fallback use remains visibly labeled.

## Scheduler and validation

The **Automation Hub Dispatcher** is the sole scheduler: `knugget929/chatgpt-automation-hub/jobs/gme-squeeze-watch.md`, router key `gme_squeeze_watch`. Do not create separate ChatGPT tasks or GitHub Actions. Activate only after exact-head Tier A PASS, independent review, merge and production cutover verification.

Follow `docs/GME_AUTOMATION_VALIDATION_CONTRACT.md`. Tier A is mandatory for development, schemas, gates, validators, tests, structural storage and releases. It lists all full commands and the immutable-history baseline requirement. Ordinary Hub research uses Tier B's recorded GitHub head/blob set and exact A–D patterns; Node availability is not a gate for those patterns.

## Run flow

1. Pin main and read the contract, deterministic engine, records and immutable file manifests. Record head and blob SHAs.
2. Retrieve public Nasdaq/Cboe observations, SEC EDGAR and GameStop investor relations, the official short-interest calendar/publication and appropriate context sources. `node scripts/fetch-gme-observations.mjs` is an optional Tier A collection helper, never mandatory in a connector-only run.
3. Distinguish provider retrieval time, effective date, missing/conflicting evidence and limitations. Preserve failed observations; never replace them with zero, false, neutral or fabricated unchanged values.
4. Build the smallest complete candidate: routine observation; health-only failure/degradation; material event; or reproducible state transition. No material news means no invented event. No complete valid observation means health-only, not a fabricated daily snapshot.
5. Validate the exact Tier B pattern against the pinned baseline, including gate reproducibility for evidence updates, immutable history, public sources and prohibited fields. If an invariant cannot be checked, stop the write.
6. Recheck concurrency, commit atomically if possible, and read back canonical records. With sequential writes, immutable items/snapshots precede their indexes and health is last. Never delete historical files or safely staged events on retry.
7. Reload the existing Site and verify its checked/observed timestamps and canonical source. Do not deploy.

Ordinary price moves do not automatically warrant alerts. A material event changes a causal mechanism, gate, confidence, competing thesis or falsifier. Delayed short interest is never real-time positioning; short-volume ratios are not short interest; options activity does not reveal dealer inventory; unavailable borrow is unknown, never normal.
