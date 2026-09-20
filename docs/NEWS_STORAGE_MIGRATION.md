# News Storage Migration

Status: **READER DEPLOYED — AWAITING G2 REVIEW / MERGE**

This migration splits Kong's material-news ledger and scheduled-run state into independently writable records without deleting or rewriting the legacy `data/news.json`.

## Production reader deployment

- Production Site: https://vita-learning-atlas.viet591697.chatgpt.site
- Split-reader source: `d7ff9a2dc3327f3af7aad839bcb8dae828fb3a81`
- Deployed Site source commit: `0d7ae54b7c156aa95d70d18e2f2cc2c777eb42d4`
- Deployed reader paths: `data/checks/latest.json`, `data/news/index.json`, and `data/news/items/<stable-id>.json`

The Site shell is deployed, but PR #1 is not yet merged. The live reader therefore cannot complete the split-path cutover because those records are not yet available on `main`. Until the PR passes its G2 review and is merged, scheduled automation must continue updating the legacy `data/news.json`.

## Phase A — compatibility / pre-cutover

Current state:

- all historical news is mirrored into `data/news/items/<stable-id>.json` on the migration branch;
- `data/news/index.json` contains the visible ordered history;
- `data/checks/latest.json` contains the latest run state;
- the production `dist/app.js` prefers the split format and falls back to `data/news.json`;
- `data/news.json` remains intact and authoritative until the branch is merged and split reads are verified.

During Phase A, scheduled automation **must keep its existing legacy write behavior**. It may also write/validate the split records to prove the path, but it must not freeze the monolith yet.

## Activation gate

Switch to split-only normal writes only after all of the following are true:

1. [x] the reviewed split-reader commit is deployed to the production Site shell;
2. [ ] PR #1 is merged so the split records are available on `main`;
3. [ ] production is verified to load `data/checks/latest.json`, `data/news/index.json`, and the indexed item files;
4. [ ] the current latest-check timestamp and all 15 visible material items render from the split records;
5. [x] the deployed reader retains the documented legacy/snapshot fallback behavior;
6. [x] the deployed source commits are recorded above.

## Phase B — post-cutover

After the activation gate is satisfied:

- `data/checks/latest.json` becomes the only per-run state write;
- `data/news/index.json` changes only when visible material history changes;
- one new `data/news/items/<stable-id>.json` is created per material development;
- `data/thesis.json` changes only when evidence warrants a thesis/model change;
- `data/news.json` becomes a frozen compatibility snapshot and is no longer rewritten by normal scheduled runs.

Physical deletion remains a separate cleanup after a production soak period and explicit verification that no deployed reader still depends on the legacy file.

## Rollback

Rollback is non-destructive:

- before cutover, the deployed reader falls back to live `data/news.json`;
- after cutover, the reader still falls back to `data/news.json`, then `dist/data/news.json`, then the embedded baseline;
- the migration never deletes historical item data.
