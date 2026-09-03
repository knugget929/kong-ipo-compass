# Kong IPO Compass Continuous Orchestration

1. Reconcile repository, PR, check, branch, candidate, and production reality.
2. Map owner feedback to an existing or new queue item.
3. Assign work type, P0-P4 priority, risk, G0-G3 gate, dependencies, ownership, and definition of done.
4. Select up to 3 ownership-safe product tracks.
5. Builders implement, test, preview, and open PRs.
6. A fresh reviewer returns `VERIFIED`, `CHANGES_REQUESTED`, or `DECISION_REQUIRED`.
7. Auto-merge G0/G1. Merge verified G2 into the candidate line. Hold only G3 decisions.
8. Refresh the stable candidate site, retire merged or superseded PR previews, reconcile state, and start the next eligible work.

## Feedback intake

Anchor feedback to a candidate build. Return a direction receipt with observation, classification, roadmap mapping, priority, gate, and next action. P0/P1 work enters the active flow. G3 work receives a decision brief.

## Sites retention

Keep one permanent production Site, one permanent rolling candidate, and no more than three exact-commit PR review Sites whose PRs are still open or actively depended upon. After merge, closure, or supersession, resolve the exact project ID, exclude protected or unrelated projects, delete the temporary preview, re-list Sites, and reconcile state.

If deletion is unavailable, record the exact pending inventory as `DELETE_PENDING_CAPABILITY_UNAVAILABLE`, stop creating disposable previews, and never claim capacity was restored.

## Recovery

Repair straightforward test, CI, preview, stale-branch, and unambiguous integration failures autonomously. Escalate destructive actions, unavailable authority, conflicting requirements, or materially different product choices.