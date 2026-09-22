# GME Watch operations

## Canonical records

- `data/gme/current.json`: latest observation, derived metrics, inference, narrative, sources, next-state gates, and falsifiers.
- `data/gme/history/YYYY-MM-DD.json`: immutable daily thesis snapshot.
- `data/gme/history/index.json`: compact history navigation.
- `data/gme/events/`: material thesis events; an item is written before the index references it.
- `data/gme/health.json`: last attempt, last successful snapshot, and provider health.
- `dist/data/gme/`: deployment fallback copied from the canonical records.

The Site reads canonical GitHub data at run time and falls back to the deployed snapshot. `/kong` keeps the existing Kong split-data behavior.

The daily steward and event monitor are ChatGPT scheduled tasks attached to the existing GitHub repository. They use the same checked-in normalization, derivation, and validation commands; they do not add GitHub Actions or expose credentials in the Site.

## Update flow

1. Run `node scripts/fetch-gme-observations.mjs` to obtain normalized Nasdaq and Cboe observations. The script emits observations and deterministic calculations only.
2. Check SEC EDGAR, GameStop investor relations, the official short-interest calendar/publication, and reputable context sources.
3. Classify each fact by provider, observation time, effective date, freshness, and limitation.
4. Recompute state with `scripts/gme-state-engine.mjs`.
5. Compare with the previous canonical snapshot and write only material changes to `whatChanged`.
6. Write a dated history snapshot. For a material event, write its item before updating the event index.
7. Copy canonical GME data to `dist/data/gme/`.
8. Run every validator and test before committing.

Required verification:

```sh
node scripts/validate-data.mjs
node scripts/validate-gme-data.mjs
node scripts/validate-site.mjs
node --test scripts/test-news-data.mjs scripts/test-gme-state-engine.mjs scripts/test-gme-observations.mjs
```

## Routine, material, and transition events

- `ROUTINE_UPDATE`: facts refreshed without a material thesis change.
- `MATERIAL_THESIS_EVENT`: new evidence materially strengthens or weakens an engine or competing explanation.
- `STATE_TRANSITION`: the deterministic gate result changes. This receives prominent history treatment and is alert-worthy.

Ordinary price movement does not generate an alert. An event is material when it changes a causal mechanism, a state gate, confidence, a competing thesis, or a falsifier.

## Failure behavior

A failed provider does not overwrite its prior value. Update `health.json`, retain the last successful observation and effective date, and let the signal age. If the required source set cannot support the prior confidence, reduce confidence. Never write zero, neutral, or unchanged as a substitute for a failed observation.

The client recomputes source age from timestamps on every page load. A failed canonical update therefore becomes visibly older even if the deployed bundle itself does not change.
