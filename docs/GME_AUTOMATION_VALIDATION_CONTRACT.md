# GME scheduled automation validation contract

This is the normative connector-safe contract for public GME research in the Automation Hub Dispatcher. Canonical production reads use `https://raw.githubusercontent.com/knugget929/kong-ipo-compass/main/data/gme`. No routine write requires a build or deployment. Preserve the existing six engines, three theses, evidence distinctions, gates and thresholds.

## Tier A: development and release

Mandatory for code, state-engine, threshold/gate, schema, validator, test, structural storage, release or deployment changes. From the exact candidate head run:

```sh
node scripts/validate-data.mjs
node scripts/validate-gme-data.mjs ed7f7335bbac20b68c533c96b265ae05372f0a0f
node scripts/validate-site.mjs
node scripts/validate-project-state.mjs
node --test scripts/test-*.mjs
```

The immutable-history baseline above is the recovered PR head, not a fixed newest snapshot date. For subsequent development also validate against the pre-change main SHA to protect every later immutable file. The complete suite includes Kong news regressions and GME state, observation, client and transition tests. Validate the PR's exact-head independent review with `node scripts/validate-pr-gate.mjs <review-event.json>`. No builder-only review, weakened tests, or GitHub Actions. A connector-only development session may prepare a PR but cannot merge/release without Tier A PASS.

## Tier B: recorded GitHub reads and deterministic comparisons

Node and a full checkout are unnecessary for the exact patterns below. Read this contract, `scripts/gme-data.mjs`, `scripts/gme-validation.mjs` and `scripts/gme-state-engine.mjs` at one recorded main head H; retain their blob SHAs. The implementation and this contract must agree; a disagreement fails closed to Tier A.

Read `current.json`, `health.json`, `history/index.json`, `events/index.json` under `data/gme/` at H, retaining their blob SHAs. List the complete history and event item filename/blob sets at H (reject truncated listings). For an observation or event update, read the indexed snapshots/events and any orphan involved in the update, sufficient to check the bundle rules below. A health-only run may rely on the previously validated immutable files plus the complete filename/blob sets: it changes no evidence, index or state and verifies that every indexed path still exists. Retain all read blob SHAs in the run receipt. Candidate files must be complete JSON, not truncated patches. Compare the complete changed-path set and validate every changed record before writing.

Immediately before committing re-read main and target/read blobs. Require the same H and recorded blobs. Prefer one atomic multi-file Git tree commit with parent H; update main using a non-forced fast-forward. If main moved after validation, restart with fresh reads. Do not merge an automation candidate with a competing commit or force a stale update. With sequential writes track each returned head and stop on any external movement. Content API blob preconditions alone do not prove branch-head stability.

## Common record invariants

- `schemaVersion === 1` everywhere; snapshot `symbol === "GME"`; positive integer revision.
- Observation/effective/retrieval/capture/check/index/event timestamps are real ISO date-times with explicit Z or numeric timezone; reject impossible dates. Date-only fields use real `YYYY-MM-DD`. Snapshot date equals observation's date portion; short interest's effective date stays its reporting date, never the retrieval date.
- Renderer-required text/array fields must be present and correctly typed, including interpretation, state summary/confidence reason, engine display fields, thesis supports/contradictions, relationships, options concentrations, upcoming catalyst certainty and historical warning. Sources retain freshness/kind/limitations. State label and confidence label must match the deterministic keys; narrative cannot relabel ATTENTION as SQUEEZE or MEDIUM as HIGH.
- Exactly six distinct engine keys: short, borrow, options, market, catalyst, supply. Exactly three distinct thesis keys: squeeze, fundamental, normal.
- States are DORMANT, ATTENTION, PRESSURE, REFLEXIVE, SQUEEZE, DISLOCATION; levels are their zero-based positions. Confidence key must reproduce from coverage/freshness. Historical event states may be UNRECORDED when the original event predates classification; new indexed events must use actual prior/candidate states.
- Engine/observation statuses agree and remain OBSERVED, INFERRED, ESTIMATED, STALE, UNAVAILABLE, CONFLICTING or NOT_APPLICABLE. Keep strengthening, weakening, unchanged and unknown arrays; preserve forward/backward conditions, falsifiers and catalyst map. An empty new-evidence category is allowed.
- Sources have unique IDs, name, public HTTPS URL without embedded credentials, tier 1–7, observedAt and effectiveAt. Retrieval cannot postdate the snapshot. Every engine/catalyst/event source ID resolves to retained public evidence. An existing source ID's record is immutable; use a new ID for a fresh retrieval. Old sources may leave current only when no current reference needs them and preserved history retains event evidence. Failed-source records remain unchanged.
- Derive stored market metrics from the actual preserved session window; derive all engineInputs and the state using the checked-in functions. Never infer direct covering, dealer feedback or dislocation from price/options activity. New true direct-mechanism claims require dated, engine-referenced public sources with kinds covering, dealer_feedback, dislocation or borrow respectively, freshness RECENT and effective age 0–4 days. That checks provenance structure; the research must also substantiate the claim.
- History entries are unique, newest date first, filename exactly YYYY-MM-DD.json. Each indexed snapshot exists, preserves recordKind DAILY_THESIS_SNAPSHOT, capturedAt equal to observedAt, all evidence/engines/theses, and independently reproduces its state. Index state/previousState/transitionKind/thesisDirection match its snapshot. Current snapshotDate equals the newest indexed date. Intraday current may advance after that day's first immutable snapshot.
- Events have unique stable filename-safe IDs, newest occurrence first. Path is items/<id>.json; every indexed file exists and matches id/occurredAt/type/category/title. Events preserve mechanism, observations, sources and state effect. History importantEventIds resolve to indexed events; current catalyst eventIds resolve to items. Valid unindexed event files are safe.
- Health has OK/DEGRADED/FAILED status, lastAttemptAt >= lastSuccessfulSnapshotAt, and a nonempty summary. lastSuccessfulSnapshotAt equals current.observedAt. Providers are exactly market, options, sec, company, short_interest, borrow; provider statuses are OK, STALE, FAILED, UNAVAILABLE, UNAVAILABLE_EXPECTED, CONFLICTING. Non-null lastSuccessAt must be a valid timestamp no later than the attempt. OK requires a success timestamp. Any non-OK provider forbids overall OK.
- Never delete or rewrite any historical snapshot or event item in routine runs. Existing index entries and retrospective regimes stay unchanged and in order; no truncation of historical records.
- No credentials, private holdings, private messages or private research, including in narrative values. Recursively reject keys normalized to lowercase with punctuation removed matching: password, passwd, secret, apikey, token, accesstoken, refreshtoken, credential, credentials, authorization, cookie, cookies, privatekey, message, messages, email, emails, holding, holdings, personalholdings, privateholdings, privateresearch, researchnotes, privatenotes, privatemessage, privatemessages, accountnumber, accountid, ownedshares, costbasis. Public issuer/insider share observations are allowed; personal positions are not.
- No `dist/*`, UI/Site, Kong, code, docs, schema, test, workflow or other files in a routine candidate. GitHub Actions remain prohibited.

## Exact allowed patterns

### A. Routine observation refresh

Change current.json and health.json. Increment current.revision by exactly one and advance observedAt and lastAttemptAt. At least one new public source must have observedAt equal to the new observation time; retrieval of unchanged public evidence is allowed only if actually retrieved. Keep effective dates truthful. Preserve failed provider observations completely (including values and effective dates), source records, and lastSuccessAt. Failed provider mapping: market→market, options→optionsPressure, short_interest→shortPressure, borrow→borrowPressure, sec→supplyPressure/catalystPressure, company→catalystPressure. If this conservative mapping prevents a partial update, use B or Tier A.

On a new UTC observation date, also create exactly one immutable history/YYYY-MM-DD.json and prepend its history/index.json entry; set history.updatedAt to observedAt. The new snapshot equals the complete candidate current plus recordKind and capturedAt. Previous index entries are byte/structurally unchanged. Within an already captured date, do not rewrite its snapshot or history index. Set state.previous to the baseline key, transitionKind and health.runKind ROUTINE_UPDATE, thesisDirection MATERIALLY_UNCHANGED. No event/index change is required or allowed for a non-material refresh.

### B. Provider failure / degraded refresh

Change **only health.json**. Advance lastAttemptAt; set runKind ROUTINE_UPDATE and status DEGRADED or FAILED with an honest summary of attempted providers and the limitation. Preserve lastSuccessfulSnapshotAt and every provider lastSuccessAt. Update provider status to reflect the attempted result. Current, historical observations, source timestamps, numeric values and classifications remain untouched and age naturally in the reader. Never substitute zero, false, neutral or fabricated unchanged data. No pretend successful snapshot or daily snapshot is required for a failed research run.

### C. Material thesis event

Apply A's observation/history rules, then add exactly one new events/items/<stable-id>.json and update events/index.json. Alternatively index one already valid staged item. Prepend/insert the one event in timestamp order without modifying or removing prior entries; index.updatedAt equals candidate observedAt. The event cites at least one newly retrieved candidate source, records baseline/candidate states, and documents a real mechanism/thesis change. Set transitionKind/health.runKind MATERIAL_THESIS_EVENT unless D applies. No forced material event for an ordinary check.

A separately staged write may create exactly one valid unindexed event item with resolvable public sources and change no other file. It does not claim that the observation refreshed. A retry may index that existing item only after repeating all baseline checks.

### D. State transition

Apply A or C, but set state.previous to the baseline state, transitionKind and health.runKind STATE_TRANSITION. Candidate state must differ and be the exact computed result of candidate observations, not a manually chosen label. A state transition caused by existing evidence aging does not require a fabricated material event. With no material event, thesisDirection remains MATERIALLY_UNCHANGED: this describes newly reported facts, not the derived state. New day history records the transition; intraday current preserves previous state while the day's initial snapshot stays immutable. Use Tier A for any change to the gates themselves.

## Deterministic gate reproduction (unchanged science)

Read the exact state-engine blob at H; the following is its connector checklist, not permission to alter thresholds. Preserve three-valued true/false/null semantics: OR is true if any true, false if all false, otherwise null. Strict true alone satisfies a gate.

1. Market window: >=5 finite close/volume sessions. Mean volume is sum/count; relative volume is dayVolume/mean. Volume percentile is fraction of window volumes strictly less than day volume. Absolute return percentile compares absolute day change to absolute consecutive historical returns. Missing required measurements yield null metrics.
2. Market/options current means status OBSERVED, at least one source of that kind, all effective dates <=4 days old at observedAt, and the observation's own observedAt (when present) <=4 days old. Market volume and absolute return percentiles each need >=0.9.
3. Short elevated: pctSharesOutstanding >=20; rising: changeFromPriorPct >=5; fresh: effective reporting date <=15 days old. Keep directCoveringEvidence separate. Missing measurements are null; delayed short reports never establish live covering.
4. Borrow stressed/fresh are the observed evidence booleans only when status OBSERVED, otherwise null. Options activity percentile >=0.9 and near-money call volume share >=0.2 require current options. FeedbackDemandObserved remains separate, never derived from option volume.
5. Catalyst: at least one dated item linked to tier 1–2 source; newest such item <=3 days and catalyst status OBSERVED. Supply expanding is tri-state OR of recentNoteExchangeShares/sharesOutstanding >=0.1 with issuance age <=30 days and warrantSharesPotential/sharesOutstanding >=0.1 while warrants remain active through expiry +1 day.
6. Structural count: (elevated AND rising AND fresh short), (stressed AND fresh borrow), (elevated calls AND near-money concentration). Demand count: (abnormal volume AND price acceleration), material catalyst.
7. In descending precedence: SQUEEZE needs abnormal volume, direct covering and elevated fresh short OR stressed fresh borrow; when supply expands it needs BOTH. DISLOCATION additionally needs severeDislocation. REFLEXIVE needs abnormal volume, elevated calls, concentration, observed feedback and structural count >=2 (>=3 when supply expands). PRESSURE needs abnormal volume, that same structural count and demand count >=2. ATTENTION needs demand>=1, structural>=1, abnormal attention or catalyst. Otherwise DORMANT only if at least one of attention, market volume/price, short positioning, borrow stress, options activity or catalyst is a known boolean; all unknown fails, never defaults to dormant.
8. Confidence coverage counts known short positioning, borrow stress, options activity, market volume, catalyst, supply. LOW for coverage<=3 or state level>=3 without covering or feedback. MEDIUM for coverage<=5 or explicitly stale short/borrow. Otherwise HIGH. Preserve limitations alongside the label.

## Write order and failure rule

Prefer one atomic commit for the entire validated candidate. If sequential writes are necessary: new event item first, then new history snapshot, event index, history index, current, health last (skip unchanged paths). Track the expected branch head after every step. The client may temporarily use its complete deployed fallback if a bundle is incomplete. Do not claim a successful run until all writes and a readback pass. A stopped sequence may leave safe unindexed immutable files; never delete them to compensate. A subsequent run must reconcile the exact partial state or use Tier A, never blindly replay.

If a read, comparison, derivation, public-evidence requirement, concurrency check or path rule is unresolved, commit nothing. A provider failure itself may be recorded with B if B passes. Retain a run receipt with H, read blob set, candidate paths, pattern, invariant outcomes, evidence limitations and final commit. No deployment follows a Tier B write.
