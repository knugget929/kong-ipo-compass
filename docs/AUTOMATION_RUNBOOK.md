# Nightly Kong Thesis Steward

The scheduled task researches major Kong developments and writes the public data layer in `knugget929/kong-ipo-compass`.

## Every run

1. Check Kong primary sources, SEC filing sources, credible financing/market sources, and material competitive developments.
2. Separate confirmed facts from inference and unresolved questions.
3. Decide `UPGRADE`, `MAINTAIN`, or `DOWNGRADE` using the recorded decision rules.
4. Update `data/news.json` with the check time, run status, concise summary, and any material items.
5. Update `data/thesis.json` only when evidence changes the score, verdict, model defaults/references, catalyst balance, milestones, unknowns, or sources.
6. Increment the revision of each changed file, validate both files, and commit directly to `main`.

## Guardrails

- Do not modify UI files or redeploy the Site for a data-only update.
- Do not add GitHub Actions.
- Do not add personal holdings or private source material.
- Do not add routine marketing announcements unless they plausibly affect revenue quality, competitive position, IPO readiness, dilution, or valuation.
- If the repository is missing, permissions fail, sources conflict materially, or JSON validation fails, report the blocker and leave canonical data unchanged.
- Keep at most 30 material news items, newest first; do not silently remove the latest thesis-changing event.