# GME recovery checkpoint and validation

Recovery date: 2026-09-22. Original workspace: `/workspace/scratch/38247cd1189c/kong-ipo-compass`.

## Durable recovery

- Branch: `feature/gme-squeeze-watch`, created from main `02d6cce3b5709a2501500ab8e62d63e28c54161c` before inspecting the recovered build.
- Recovery checkpoint: `da680b3ce932b060ebf8eb20954846ff69e5bbe7`, verified by reading the GitHub branch ref before running validation.
- Recovered the existing six-engine implementation, canonical records, evidence contracts, gates, falsifiers, competing theses, historical snapshots, scientific controls, and UI. No reconstruction or redesign.

## Genuine corrections

- Synchronized deployed GME fallback records with the recovered canonical records.
- Pointed GME runtime data at this feature branch; main intentionally has no GME until the PR is merged. Kong continues to read main.
- Market/options status and effective timestamps now gate scientific inputs; stale or undated feeds cannot contribute structural confirmations.
- Fully missing observations fail classification instead of being called dormant.
- The client uses effective feed ages, shows an old classification as LAST SNAPSHOT, and withdraws current confidence when a required feed is stale/undated.
- Restored Kong root and copied `/kong` HTML/JS/CSS to exact main bytes, including original line endings. Kong canonical data and automation runbook are unchanged.
- Retained the recovered date-validator regex correction: it accepts real ISO dates, allowing the existing data tests to run. This does not change Kong runtime behavior.

## Verification

- `node scripts/validate-data.mjs`: PASS.
- `node scripts/validate-gme-data.mjs`: PASS; reproducible ATTENTION baseline, medium confidence, nine sources, three preserved events.
- `node scripts/validate-site.mjs`: PASS.
- `node --test scripts/test-*.mjs`: 45/45 PASS, including price-only/social-hype controls, independent confirmations, expanding supply, stale/unknown borrow, direct-covering requirements, six new stale market/options controls, empty-evidence rejection, canonical/fallback/failure client behavior, and unsafe source URL rejection.
- Browser: `/gme/` renders six engines and canonical known-gap status; all nine source links expand; `/kong/` renders the existing model and live GitHub thesis/news data.
- Responsive browser measurements of GME in 375/768/1024/1440 CSS-pixel frames: document scroll widths equal client widths (360/753/1009/1425 after scrollbar), with no horizontal overflow.
- Independent review of the corrected worktree: PASS; no remaining blocker in bounded scientific/freshness review.
- All nine source URLs retain HTTPS provenance. Web retrieval resolved seven source pages; Cboe exceeded the reader size limit and the SEC Schedule 13D XML produced a reader error. Those two destination fetches are not claimed as verified; their links were preserved rather than replaced speculatively.

## Release boundaries

No main merge, separate Site, GitHub Actions, new automation, or redesign. The existing Site project is `appgprj_6a7e1998fde08191b1b90a896699bb00`. Its existing source branch has independent history; the exact validated GitHub commit can be saved on a feature source branch without overwriting that history. Deployment and live-route results belong in the PR/release report after publication.
