# Kong Scheduled Automation Validation Contract

This document is the normative validation contract for routine post-cutover Kong scheduled research writes when the runtime can read/write GitHub records but cannot execute Node or materialize a complete repository checkout.

It does **not** replace full repository validation for development work.

## Two validation tiers

### Tier A — full repository validation

Run both commands from a runnable repository checkout:

```bash
node scripts/validate-data.mjs
node --test scripts/test-news-data.mjs
```

Tier A is mandatory for code changes, schema changes, migrations, validator changes, test changes, release/deployment work, and structural changes to the news architecture. A connector-only development runtime may create a branch and PR when Tier A cannot be executed locally, but that limitation must be recorded and the change must not be merged or released until both Tier A commands pass from a runnable repository checkout.

### Tier B — connector-safe scheduled-write validation

Tier B is allowed only for ordinary scheduled research runs whose complete intended change is one of the three exact post-cutover patterns below. It uses GitHub reads plus deterministic comparisons against the current canonical records. Lack of Node execution alone is not a blocker for these routine split-file writes.

If a candidate does not fit one of the exact patterns, Tier B is ineligible: use Tier A or commit nothing.

## Shared constants

- Schema version: `1`.
- Thesis decisions: exactly `UPGRADE`, `MAINTAIN`, `DOWNGRADE`.
- Run statuses committed by routine runs: exactly `NO_MATERIAL_CHANGE`, `MATERIAL_CHANGE`.
- Impact values: exactly `positive`, `neutral`, `negative`.
- Significance values: exactly `high`, `meaningful`, `noted`.
- Maximum visible news history: `historyLimit <= 30`; the candidate index must also contain no more than its own positive integer `historyLimit`.
- Latest-check summary: non-empty after trimming and no more than 1,200 characters.
- `lastCheckedAt` and thesis `updatedAt`: ISO-8601 date-time with an explicit `Z` or numeric UTC offset and a real parseable instant.
- Publication/as-of/change-log dates: ISO `YYYY-MM-DD` or an existing validator-compatible ISO date/time, and parseable.
- URLs required by this contract must use `https:`.

## Prohibited/private data rule

Canonical scheduled-write records must contain no credentials, secrets, personal holdings, private messages, or private research. Candidate content must come from public research suitable for the repository and cite public HTTPS sources where evidence is required.

As a structural backstop, recursively reject field names that normalize (case-insensitive; punctuation removed) to any of:

`password`, `passwd`, `secret`, `apikey`, `token`, `accesstoken`, `refreshtoken`, `credential`, `credentials`, `authorization`, `cookie`, `cookies`, `privatekey`, `message`, `messages`, `email`, `emails`, `holding`, `holdings`, `personalholdings`, `privateholdings`, `privateresearch`, `researchnotes`, `privatenotes`, `privatemessage`, `privatemessages`, `accountnumber`, `accountid`.

`ownedShares` and `costBasis` are also prohibited outside the existing thesis model schema. Inside `data/thesis.json`, their defaults must remain exactly `0`; the existing calculator ranges may remain.

## Baseline reads and concurrency

Build every Tier B candidate against one recorded GitHub branch head.

1. Read the current `data/checks/latest.json`, `data/news/index.json`, and `data/thesis.json` from that head and retain their blob SHAs.
2. For material-news candidates, list `data/news/items/` at the same head. The filename set is sufficient to prove that every retained/indexed historical ID resolves; existing historical item bodies do not need to be re-read unless the candidate claims to modify one (which Tier B forbids).
3. For a proposed new item, confirm `data/news/items/<stable-id>.json` does not already exist at the baseline head.
4. Build the complete intended candidate before any write and validate it against the baseline using the applicable pattern below.
5. Before writing, ensure the target branch head / target blob SHAs are still the recorded baseline. Use exact blob SHAs for contents-API replacements or the recorded head as the parent of a multi-file tree commit. If the branch or target changed concurrently, restart from fresh reads; do not force a stale candidate.

The candidate changed-path set is part of validation. A Tier B run may never include `data/news.json`, any `dist/data/*` path, code, docs, schemas, validators, UI files, or unrelated project files.

## Pattern 1 — no material news

The complete changed-path set must be exactly:

- `data/checks/latest.json`

Validate the candidate latest check:

- `schemaVersion === 1`;
- `revision` is a positive integer and equals baseline revision + 1;
- `lastCheckedAt` is a valid ISO timestamp with timezone;
- `status === "NO_MATERIAL_CHANGE"`;
- `thesisDecision` is exactly `UPGRADE`, `MAINTAIN`, or `DOWNGRADE`;
- `summary` is non-empty and <= 1,200 characters;
- optional `execution` is an object, not an array;
- no prohibited/private fields.

The candidate must not modify the news index, any item, thesis, frozen `data/news.json`, or `dist/data/*`.

## Pattern 2 — material news, thesis unchanged

The complete changed-path set must be exactly:

- one new `data/news/items/<stable-id>.json`;
- `data/news/index.json`;
- `data/checks/latest.json`.

### New item

Validate:

- `schemaVersion === 1`;
- `revision === 1` for a newly created item;
- `id` is non-empty, filename-safe (`[a-z0-9][a-z0-9-]*`), and exactly matches `<stable-id>` in the filename;
- `publishedAt` is a valid ISO date/date-time;
- non-empty `title` and `summary`;
- `impact` is exactly `positive`, `neutral`, or `negative`;
- `significance` is exactly `high`, `meaningful`, or `noted`;
- `thesisDecision` is exactly `UPGRADE`, `MAINTAIN`, or `DOWNGRADE`;
- `scoreDelta` is finite;
- `confirmed` and `uncertain` are separate arrays whose entries are non-empty strings;
- at least one source exists, every source has a non-empty label, and every source URL is HTTPS;
- no prohibited/private fields.

### Index

Validate:

- `schemaVersion === 1`;
- revision is baseline index revision + 1;
- `historyLimit` is unchanged from baseline, is a positive integer, and is <= 30;
- item count is <= `historyLimit`;
- IDs are unique;
- entries are newest-first by `publishedAt`;
- the new item appears exactly once;
- the new index entry's `id`, `publishedAt`, `title`, `impact`, `significance`, `thesisDecision`, and `scoreDelta` exactly match the new item file;
- removing the new ID from the candidate index yields the baseline ID sequence truncated only at the tail as required to make room within `historyLimit`; no other historical ID may disappear or reorder;
- every candidate indexed ID exists in the baseline item-directory filename set plus the new item ID;
- no historical item file is deleted or rewritten;
- no prohibited/private fields.

An unindexed valid item file is allowed and remains a safe staged/orphan record. An indexed missing item is never allowed.

### Latest check

Validate the same latest-check invariants as Pattern 1, except:

- `status === "MATERIAL_CHANGE"`;
- `thesisDecision` must equal the new material item's `thesisDecision`.

`data/thesis.json` must remain unchanged and must not be in the candidate changed-path set.

## Pattern 3 — material news with thesis change

Apply every Pattern 2 rule, then add `data/thesis.json` to the exact changed-path set.

Validate the candidate thesis:

- `schemaVersion === 1`;
- revision is baseline thesis revision + 1;
- `updatedAt` is a valid ISO timestamp with timezone;
- `asOf` is a valid date and equals the date portion of `updatedAt`;
- the scorecard is non-empty and the sum of scorecard `score` values exactly equals `verdict.score`;
- required model defaults and `bear`, `base`, `bull` preset values for `arr`, `multiple`, `netCash`, `dilutedShares`, and `ipoDiscount` are finite;
- `model.defaults.ownedShares === 0` and `model.defaults.costBasis === 0`;
- every thesis source URL is HTTPS;
- all baseline thesis sources remain present and unchanged;
- exactly one new change-log entry is prepended; all prior change-log entries remain unchanged and in the same order;
- the new change-log entry has a valid date equal to `asOf`, a non-empty headline/detail, and a verdict equal to the latest check's `thesisDecision`;
- at least one HTTPS source URL from the newly recorded item is newly added to the thesis sources (it was not already in the baseline thesis); this is the deterministic evidence link supporting the thesis write;
- no prohibited/private fields other than the existing zero-default calculator fields described above.

A thesis write without newly recorded material evidence fails Tier B validation.

## Write order after Tier B passes

Prefer one multi-file Git tree commit containing the complete validated candidate.

If only sequential contents writes are available, validate the complete candidate first, then write in this order:

- no material news: latest check;
- material news, thesis unchanged: new item -> index -> latest check;
- material news, thesis changed: new item -> thesis -> index -> latest check.

Never delete historical item files in a routine run. If a sequential run stops after creating only the new item, that unindexed orphan is safe and the live reader ignores it.

## Failure rule

If the applicable Tier B invariants cannot all be checked, if a required GitHub read fails, if the baseline moves during validation/write, or if the candidate falls outside the exact three patterns, do not start the write. If a write sequence has already started after a successful validation and a later write fails, stop immediately; do not delete a safely staged orphan or rewrite frozen/snapshot data to compensate.

## Regression alignment

`scripts/news-data.mjs` contains the executable record validators and `validateScheduledWriteTransition(...)` used by the Node regression suite. `scripts/test-news-data.mjs` covers the Tier B transition contract. `scripts/validate-data.mjs` remains the authoritative full-repository validator for Tier A and shares the same thesis/news record validators.
