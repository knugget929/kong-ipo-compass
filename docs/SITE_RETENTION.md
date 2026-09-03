# Kong IPO Compass Sites Retention

Keep one permanent production Site, one permanent rolling candidate, and no more than three temporary exact-commit PR review Sites.

Delete a PR review Site after its PR is merged, closed, or superseded and no active dependency needs it. Before deletion, resolve the exact project ID and exclude production, the candidate, active previews, custom-domain targets, unique data stores, and unrelated projects.

After cleanup, re-list Sites and reconcile project state. If deletion is unavailable, record `DELETE_PENDING_CAPABILITY_UNAVAILABLE`, preserve the exact target list, stop creating disposable previews, and do not claim capacity was reclaimed.

When the hosting limit blocks a new exact preview but fewer than three active preview slots are in use, reuse one project already approved for deletion. Re-resolve the exact project ID, reconfirm every exclusion, deploy the exact PR head, and move the project from the pending list to the protected active list. Never list the same project in both sets.