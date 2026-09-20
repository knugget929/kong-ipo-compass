# News Storage Migration

Status: **CUT OVER / ACTIVE**

Kong's material-news ledger and scheduled-run state now use independently writable records. The production Site serves the split reader, while the legacy `data/news.json` remains intact as a frozen compatibility fallback.

## Production cutover evidence

- Production Site: https://vita-learning-atlas.viet591697.chatgpt.site
- Split-reader source: `d7ff9a2dc3327f3af7aad839bcb8dae828fb3a81`
- Deployed Site source commit: `0d7ae54b7c156aa95d70d18e2f2cc2c777eb42d4`
- Reader paths: `data/checks/latest.json`, `data/news/index.json`, and `data/news/items/<stable-id>.json`
- Verified data state: current thesis, 15 material-news items, and the latest check timestamp/summary
- Fallback retained: live `data/news.json`, then `dist/data/news.json`, then the embedded baseline

## Cutover result

The activation gate is satisfied:

1. the reviewed split-reader commit is deployed to the production Site shell;
2. the split records are available on `main`;
3. the deployed reader requests `data/checks/latest.json`, `data/news/index.json`, and the indexed item files;
4. the current latest-check state and all 15 visible material items validate through the split records;
5. the documented legacy and snapshot fallback behavior remains in the deployed reader;
6. the deployed source commits are recorded above.

## Active write contract

- `data/checks/latest.json` is the only required per-run state write.
- `data/news/index.json` changes only when visible material history changes.
- One `data/news/items/<stable-id>.json` is created per material development.
- `data/thesis.json` changes only when evidence warrants a thesis or model change.
- `data/news.json` is frozen as a compatibility snapshot and is no longer rewritten by normal scheduled runs.

Item files remain durable even when they leave the visible index. A new item may be written before the index references it, so an interrupted sequential write leaves only a safe staged orphan rather than a broken reader.

## Rollback

Rollback remains non-destructive:

- the deployed reader falls back to live `data/news.json`, then `dist/data/news.json`, then the embedded baseline;
- the migration does not delete historical item data;
- physical deletion of `data/news.json` remains a separate cleanup after a production soak period and explicit verification that no deployed reader depends on it.
