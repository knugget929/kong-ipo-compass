# Review Evidence

## KIPO-004 — Runtime thesis and major-news data layer

- Gate: G2
- Builder: root
- Independent reviewer: `/root/review_live_data`
- Verdict: VERIFIED
- Date: 2026-09-03
- Scope: remote-first GitHub JSON loading; local and embedded fallbacks; schema/date/enum/numeric/array validation; HTTPS-only external links; news score impacts; device-local personal inputs; five-tab responsive layout.
- Direct checks: `node --check dist/app.js`; `node scripts/validate-data.mjs`; `node scripts/validate-project-state.mjs`.
- Review history: initial review requested stronger runtime validation, HTTPS enforcement, and visible score deltas; follow-up identified ISO datetime parsing; all findings were corrected before verification.

## KIPO-005 — Data-only AI Gateway 2.0 thesis update

- Gate: G1
- Builder: root
- Independent reviewer: `/root/review_kipo_005`
- Verdict: VERIFIED
- Date: 2026-09-03
- Scope: official AI Gateway 2.0 GA evidence; one-point Product & position upgrade; unchanged valuation inputs; canonical-only data revisions; deploy-time snapshots intentionally untouched; validator architecture corrected to permit valid snapshot lag.
- Direct checks: `node scripts/validate-data.mjs`; `node scripts/validate-project-state.mjs`; `node --check scripts/validate-data.mjs`; score and base-price reconciliation.
- Review history: initial review found missing parseable-date checks that could let automation data pass locally but fail in the browser. The validator was aligned with the runtime for thesis, news, item, and change-log dates, then independently re-reviewed as VERIFIED.

## KIPO-006 — Late-2025 through September-2026 evidence review

- Gate: G1
- Builder: root
- Independent reviewer: `/root/review_kipo_006`
- Verdict: VERIFIED
- Date: 2026-09-03
- Scope: primary-source review of late-2025 through September-2026 news; EMEA customer growth and named wins; CFO appointment; AI-agent product and partnership expansion; StepStone preferred-share valuation mark; explicit fact-versus-estimate boundaries; canonical-only revision update.
- Direct checks: `jq empty data/thesis.json data/news.json .project/PROJECT_STATE.json`; `node scripts/validate-data.mjs`; `node scripts/validate-project-state.mjs`; `node --check scripts/validate-data.mjs`; `node --check dist/app.js`; scorecard, cumulative-news-delta, StepStone per-share, and base-price reconciliation; deploy-snapshot comparison.
- Review history: independently VERIFIED with no blocking findings. The reviewer confirmed source support, 67 + 5 = 72 score reconciliation, a $20.46 unchanged modeled price, accurate $10.24 StepStone preferred-share math and caveats, unchanged production fallbacks, and no need for a Site rebuild or deployment.
