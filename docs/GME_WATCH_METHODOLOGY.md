# GME Short Squeeze Watch methodology

## Question

The Watch asks whether the mechanisms required for a nonlinear GME short squeeze are aligning. It does not predict a price target and does not classify a squeeze from price alone.

The causal hypothesis is `demand shock × short positioning × options reflexivity × constrained supply`, opposed by new supply, liquidity, profit-taking, and easing positioning.

## State engine

The engine is a deterministic gate model in `scripts/gme-state-engine.mjs`, not a weighted score.

| State | Required evidence |
| --- | --- |
| Dormant | No material demand anomaly or independently confirmed positioning stress. |
| Attention | At least one material market, catalyst, attention, or structural observation. |
| Pressure | Abnormal market activity, at least two structural confirmations, and at least two demand-side confirmations. Expanding supply raises the structural requirement to all three channels. |
| Reflexive | Abnormal market activity, observed call activity and near-price concentration, observed feedback demand, and multiple structural confirmations. Expanding supply raises the structural requirement to all three channels. |
| Squeeze | Direct covering evidence, abnormal market activity, and elevated short positioning or stressed borrow. When supply is expanding, both positioning and borrow stress are required. |
| Dislocation | Squeeze conditions plus exceptional liquidity or price-formation stress. |

Supply is an opposing engine. It can weaken the constrained-supply thesis, but it is not transformed into a synthetic negative score.

## Operational derivation rules

The stored engine inputs are validated against raw dated fields on every run; an editor cannot assert an input independently of the observation that produces it. These are conservative operational gates, not calibrated probabilities or universal market laws:

| Derived input | Current rule | Why it exists |
| --- | --- | --- |
| Abnormal volume | At or above the 90th percentile of the prior 20 sessions | Detects attention without using an arbitrary volume multiple. |
| Price acceleration | Absolute daily return at or above the 90th percentile of the prior 20 sessions | Identifies an abnormal tape but cannot prove covering. |
| Elevated short positioning | At least 20% of shares outstanding | Prevents a merely material reported position from becoming structural confirmation. |
| Rising short positioning | At least +5% versus the prior report | Requires a material reported change. |
| Fresh short report | Effective date no more than 15 days old | Prevents delayed positioning from confirming current stress. |
| Elevated options activity | At or above the 90th percentile of its own preserved history | The input remains unknown until enough history exists. A high call/put ratio alone is insufficient. |
| Near-money concentration | At least 20% of selected call volume within $1.25 of spot | Detects concentration; it does not identify dealer inventory. |
| Recent primary catalyst | Tier 1–2 source no more than three days old | Keeps news commentary from becoming a demand gate. |
| Expanding supply | Recent issuance or contingent share capacity at least 10% of outstanding shares | Raises, rather than lowers, the evidence required for higher states. |

The short-positioning and supply thresholds are intentionally conservative guardrails selected to prevent false positives. They have not been fit to predict returns and should be reconsidered only with broader historical evidence. The user interface exposes the underlying observations and limitations rather than presenting these gates as statistical certainty.

## Evidence boundaries

The contract separates:

1. observations: provider facts with observation and effective dates;
2. derived metrics: deterministic calculations such as relative volume;
3. inference: causal interpretation with explicit gates;
4. narrative: the human-readable explanation.

`OBSERVED`, `STALE`, `UNAVAILABLE`, `CONFLICTING`, `ESTIMATED`, `INFERRED`, and `NOT_APPLICABLE` are first-class states. Missing evidence never becomes zero or normal.

Observed options volume and open interest do not reveal dealer inventory. A gamma or hedging loop is not asserted without separate feedback-demand evidence. Exchange-reported short interest is delayed and never described as real-time.

## Controls

`scripts/test-gme-state-engine.mjs` includes negative controls for a price-only rally, a social-attention spike, stale structural evidence, call activity without observed feedback, expanding supply, and a documented extreme regime.

The price-only and social controls cannot advance beyond Attention. Stale evidence lowers confidence. A Squeeze classification requires direct covering evidence.

## Historical context

January 2021 is a mechanism benchmark, not a prediction template. The Watch preserves the SEC staff report's cautions: short covering contributed to the move but represented a small share of aggregate buying, and the staff did not find evidence of a gamma squeeze. Current share supply and reported short positioning are structurally different.

Live history is append-only. Retrospective regimes are labeled and never presented as if the current engine had observed unavailable data at the time.
