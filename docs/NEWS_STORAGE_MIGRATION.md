# News Storage Migration

Status: **READY_FOR_READER_DEPLOY — NOT YET CUT OVER**

This migration splits Kong's material-news ledger and scheduled-run state into independently writable records without deleting or rewriting the legacy `data/news.json`.

## Why there is a cutover gate

The production ChatGPT Site serves `dist/app.js` from the deployed static shell. Updating `dist/app.js` in GitHub does not by itself replace the JavaScript already deployed to production.

Therefore the split files may exist and validate before production actually reads them. Until the new reader is deployed and verified, the scheduled automation must continue updating the legacy `data/news.json` so the current production Site remains fresh.

## Phase A — compatibility / pre-cutover

Current state after this PR is prepared:

- all historical news is mirrored into `data/news/items/<stable-id>.json`;
- `data/news/index.json` contains the visible ordered history;
- `data/checks/latest.json` contains the latest run state;
- `dist/app.js` prefers the split format and falls back to `data/news.json`;
- `data/news.json` remains intact and authoritative for the currently deployed old reader.

During Phase A, scheduled automation **must keep its existing legacy write behavior**. It may also write/validate the split records to prove the path, but it must not freeze the monolith yet.

## Activation gate

Switch to split-only normal writes only after all of the following are true:

1. the reviewed split-reader commit is deployed to the production Site shell;
2. production is verified to load `data/checks/latest.json`, `data/news/index.json`, and the indexed item files;
3. the current latest-check timestamp and all visible material items render correctly;
4. a forced split-read failure is known to retain the documented legacy/snapshot fallback behavior;
5. the exact deployed commit is recorded in the release evidence.

## Phase B — post-cutover

After the activation gate is satisfied:

- `data/checks/latest.json` becomes the only per-run state write;
- `data/news/index.json` changes only when visible material history changes;
- one new `data/news/items/<stable-id>.json` is created per material development;
- `data/thesis.json` changes only when evidence warrants a thesis/model change;
- `data/news.json` becomes a frozen compatibility snapshot and is no longer rewritten by normal scheduled runs.

At that point the old monolith can be retired from normal automation safely. Physical deletion should remain a separate cleanup after a production soak period and explicit verification that no deployed reader still depends on it.

## Rollback

Rollback is non-destructive:

- before cutover, the old reader continues to use `data/news.json`;
- after cutover, the new reader still falls back to `data/news.json` and then `dist/data/news.json`;
- the migration never deletes historical item data.
