# Kong IPO Compass Agent Operating Contract

Act on recorded priorities and continue the next safe task. The product owner supplies direction, not routine scheduling or PR approval.

Read `docs/BUILD_PLAN.md`, `docs/ORCHESTRATION.md`, `docs/SITE_RETENTION.md`, `.project/WORK_QUEUE.yaml`, `.project/PROJECT_STATE.json`, and `.project/REVIEW_POLICY.yaml` before an orchestration cycle. Reconcile repository and hosting reality before trusting stale prose.

## Roles

- Triage steward maps feedback and priorities.
- Builders own isolated implementation scopes.
- An independent reviewer verifies every G1-G3 PR.
- The release steward merges, reconciles, refreshes the candidate site, and continues.

Do not let a builder be the only reviewer of its PR.

## Product boundaries

- This is a personal decision-support model for a private company, not an offer, solicitation, or investment recommendation.
- Keep reported facts, user-supplied estimates, and model assumptions visibly distinct.
- Never present an IPO date, filing, ARR, share count, valuation, or secondary-market price as confirmed without a dated source.
- The calculator is client-side and device-local. Do not transmit the user's share count or cost basis.
- Keep the model formula transparent: implied enterprise value = ARR × selected multiple; equity value = enterprise value + net cash; modeled IPO equity value = equity value × (1 − IPO discount); price = modeled IPO equity value ÷ fully diluted shares.
- Public GitHub `data/thesis.json` and `data/news.json` are the canonical live records. The Site fetches them at runtime; `dist/data/*` are deploy-time fallbacks only.
- Never put personal holdings, credentials, or private research in canonical GitHub data. Share count and cost basis remain browser-local.
- Material thesis changes require cited evidence, a dated change note, and an explicit upgrade, maintain, or downgrade verdict.
- Data-only thesis/news updates must preserve schema version 1 and pass `node scripts/validate-data.mjs`; they do not require a Site rebuild.

## Delivery constraints

- LOW_AGENTIC_USAGE: prefer one bounded product lane and lightweight direct checks.
- Do not add or enable GitHub Actions. Use the local validation commands documented in the build plan.
- Preserve a full-screen, no-horizontal-scroll experience on phone, iPad portrait/landscape, and desktop.
- Keep explanations behind disclosure controls unless they are needed to interpret the current result.

## Gates

- G0: local deterministic checks; merge automatically.
- G1: independent review; merge automatically when verified.
- G2: independent review; merge to the release candidate and refresh the candidate site.
- G3: obtain an explicit product-direction decision.

One blocked or awaiting chain never freezes unrelated eligible work. Clear approval means merge, reconcile, and continue. `Stop` means do not launch new work.

Keep one production Site and at most three active exact-PR previews. Retire merged or superseded preview Sites after exact-target verification; never delete unrelated projects or falsely report cleanup when the hosting capability cannot perform it.

## Communication

Use `NO ACTION NEEDED`, `CANDIDATE SITE UPDATED`, `NEEDS YOUR REVIEW`, `DECISION NEEDED`, or `PRODUCTION INCIDENT`. Do not narrate bookkeeping.