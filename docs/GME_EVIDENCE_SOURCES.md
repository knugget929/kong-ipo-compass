# GME evidence sources

## Source hierarchy and cadence

| Signal | Preferred source | Canonical cadence | Freshness rule | Failure behavior |
| --- | --- | --- | --- | --- |
| Price and volume | Nasdaq market data | End-of-day snapshot; event checks during market hours | Recent/session | Preserve last observation, mark provider failure, age visibly. |
| Options | Cboe delayed quote table | End-of-day snapshot; event checks during market hours | Provider timestamp | Preserve last observation; never infer dealer inventory. |
| Short interest | Exchange/FINRA publication; secondary transcription only when the official value is not directly accessible | Each publication | Effective and publication dates kept separately | Keep prior observation as stale; never interpolate. |
| Borrow | Timestamped provider with defensible terms | Provider-dependent | Provider timestamp | `UNAVAILABLE`; confidence falls. No free source met the baseline contract. |
| SEC filings | SEC EDGAR | Event-driven | Filing acceptance/effective time | Preserve last state and record a health failure if EDGAR cannot be checked. |
| Company events | GameStop investor relations | Event-driven and daily | Publication time | Prefer the corporate release to coverage of the release. |
| Capital structure | SEC filings | Filing-driven | Filing-specific effective date | Model conditions individually; do not invent one fully diluted count. |
| Journalism | Reputable publication | Daily | Publication time | Context only when a primary document does not cover the event. |
| Social attention | Optional attention-only input | Event-driven | Observation window | Cannot establish covering, borrow stress, or a squeeze. |

## Current baseline limitations

- Reported short interest is effective August 31, 2026 and is stale for current positioning.
- Float percentage and days-to-cover values vary across providers because float and average-volume definitions differ.
- Reliable current borrow fee, shares available, and utilization are unavailable without a paid or authenticated provider.
- Cboe observations contain contract activity, open interest, and implied volatility; they do not contain dealer inventory or hedging.
- Capital-structure effects from warrants and convertible notes depend on price, contract terms, and holder behavior.

The provider boundary is explicit in `data/gme/current.json`. A future paid borrow or full options provider can be added without changing the state semantics.

