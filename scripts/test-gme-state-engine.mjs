import assert from "node:assert/strict";
import test from "node:test";
import { classifySnapshot } from "./gme-state-engine.mjs";

const quiet = {
  attention: { abnormal: false },
  short: {
    positioningElevated: false,
    positioningRising: false,
    directCoveringEvidence: false,
    fresh: true,
  },
  borrow: { stressed: false, fresh: true },
  options: {
    callActivityElevated: false,
    nearMoneyConcentration: false,
    feedbackDemandObserved: false,
  },
  market: {
    abnormalVolume: false,
    priceAcceleration: false,
    severeDislocation: false,
  },
  catalyst: { materialDemandCatalyst: false },
  supply: { expanding: false },
};

function withPatch(base, patch) {
  return Object.fromEntries(
    Object.keys({ ...base, ...patch }).map((key) => [
      key,
      { ...(base[key] ?? {}), ...(patch[key] ?? {}) },
    ]),
  );
}

test("ordinary trading remains dormant", () => {
  assert.equal(classifySnapshot(quiet).key, "DORMANT");
});

test("price-only control cannot classify a squeeze", () => {
  const result = classifySnapshot(
    withPatch(quiet, {
      market: { abnormalVolume: true, priceAcceleration: true },
    }),
  );
  assert.equal(result.key, "ATTENTION");
});

test("social-hype control cannot advance beyond attention", () => {
  const result = classifySnapshot(
    withPatch(quiet, { attention: { abnormal: true } }),
  );
  assert.equal(result.key, "ATTENTION");
});

test("one short mechanism cannot count as two independent confirmations", () => {
  const result = classifySnapshot(
    withPatch(quiet, {
      short: { positioningElevated: true, positioningRising: true },
      market: { abnormalVolume: true, priceAcceleration: true },
      catalyst: { materialDemandCatalyst: true },
    }),
  );
  assert.equal(result.key, "ATTENTION");
});

test("expanding supply cannot masquerade as structural confirmation", () => {
  const baseline = withPatch(quiet, {
    borrow: { stressed: true },
    options: { callActivityElevated: true, nearMoneyConcentration: true },
    market: { abnormalVolume: true, priceAcceleration: true },
    catalyst: { materialDemandCatalyst: true },
  });
  assert.equal(classifySnapshot(baseline).key, "PRESSURE");
  assert.equal(classifySnapshot(withPatch(baseline, { supply: { expanding: true } })).key, "ATTENTION");
});

test("stale structural evidence lowers certainty", () => {
  const result = classifySnapshot(
    withPatch(quiet, {
      short: {
        positioningElevated: true,
        positioningRising: true,
        fresh: false,
      },
      options: { callActivityElevated: true, nearMoneyConcentration: true },
      market: { abnormalVolume: true, priceAcceleration: true },
      catalyst: { materialDemandCatalyst: true },
    }),
  );
  assert.equal(result.key, "ATTENTION");
  assert.equal(result.confidence.key, "MEDIUM");
});

test("current baseline is attention when structural observations are stale or unavailable", () => {
  const result = classifySnapshot(
    withPatch(quiet, {
      attention: { abnormal: true },
      short: {
        positioningElevated: false,
        positioningRising: true,
        directCoveringEvidence: false,
        fresh: false,
      },
      borrow: { stressed: null, fresh: false },
      options: {
        callActivityElevated: null,
        nearMoneyConcentration: true,
        feedbackDemandObserved: false,
      },
      market: { abnormalVolume: true, priceAcceleration: true },
      catalyst: { materialDemandCatalyst: true },
      supply: { expanding: true },
    }),
  );
  assert.equal(result.key, "ATTENTION");
  assert.equal(result.confidence.key, "MEDIUM");
});

test("options activity without observed feedback cannot be called reflexive", () => {
  const result = classifySnapshot(
    withPatch(quiet, {
      short: { positioningElevated: true, positioningRising: true },
      borrow: { stressed: true },
      options: {
        callActivityElevated: true,
        nearMoneyConcentration: true,
        feedbackDemandObserved: false,
      },
      market: { abnormalVolume: true, priceAcceleration: true },
      catalyst: { materialDemandCatalyst: true },
    }),
  );
  assert.equal(result.key, "PRESSURE");
});

test("observed options feedback can unlock reflexive state", () => {
  const result = classifySnapshot(
    withPatch(quiet, {
      short: { positioningElevated: true, positioningRising: true },
      options: {
        callActivityElevated: true,
        nearMoneyConcentration: true,
        feedbackDemandObserved: true,
      },
      market: { abnormalVolume: true, priceAcceleration: true },
      catalyst: { materialDemandCatalyst: true },
    }),
  );
  assert.equal(result.key, "REFLEXIVE");
});

test("direct covering plus stressed positioning is required for squeeze", () => {
  const result = classifySnapshot(
    withPatch(quiet, {
      short: {
        positioningElevated: true,
        positioningRising: true,
        directCoveringEvidence: true,
      },
      market: { abnormalVolume: true, priceAcceleration: true },
    }),
  );
  assert.equal(result.key, "SQUEEZE");
});

test("expanding supply raises the squeeze positioning gate", () => {
  const baseline = withPatch(quiet, {
    short: { positioningElevated: true, positioningRising: true, directCoveringEvidence: true },
    market: { abnormalVolume: true, priceAcceleration: true },
    supply: { expanding: true },
  });
  assert.notEqual(classifySnapshot(baseline).key, "SQUEEZE");
  assert.equal(classifySnapshot(withPatch(baseline, { borrow: { stressed: true } })).key, "SQUEEZE");
});

test("documented extreme regime can classify dislocation", () => {
  const result = classifySnapshot(
    withPatch(quiet, {
      short: {
        positioningElevated: true,
        positioningRising: true,
        directCoveringEvidence: true,
      },
      borrow: { stressed: true },
      options: {
        callActivityElevated: true,
        nearMoneyConcentration: true,
        feedbackDemandObserved: true,
      },
      market: {
        abnormalVolume: true,
        priceAcceleration: true,
        severeDislocation: true,
      },
      catalyst: { materialDemandCatalyst: true },
    }),
  );
  assert.equal(result.key, "DISLOCATION");
});

for (const fresh of [false, null, undefined]) {
  test(`borrow freshness ${fresh} cannot unlock reflexivity or pressure`, () => {
    const baseline = withPatch(quiet, {
      borrow: { stressed: true, fresh },
      options: { callActivityElevated: true, nearMoneyConcentration: true, feedbackDemandObserved: true },
      market: { abnormalVolume: true, priceAcceleration: true },
      catalyst: { materialDemandCatalyst: true },
    });
    assert.equal(classifySnapshot(baseline).key, "ATTENTION");
    assert.equal(classifySnapshot(withPatch(baseline, { options: { feedbackDemandObserved: false } })).key, "ATTENTION");
  });
  test(`stale or unknown positioning freshness ${fresh} cannot unlock squeeze or dislocation`, () => {
    for (const severeDislocation of [false, true]) {
      const result = classifySnapshot(withPatch(quiet, {
        short: { positioningElevated: true, directCoveringEvidence: true, fresh },
        borrow: { stressed: true, fresh },
        market: { abnormalVolume: true, severeDislocation },
      }));
      assert.ok(result.level < 4);
    }
  });
}

// Regressions found during recovery review: stale inputs cannot unlock gates.
import { readFileSync } from "node:fs";
import { deriveEvidenceInputs } from "./gme-state-engine.mjs";
const recovered = JSON.parse(readFileSync(new URL("../data/gme/current.json", import.meta.url)));
for (const kind of ["market", "options"]) {
  for (const failure of ["stale-status", "old-effective-date", "missing-effective-date"]) {
    test(`${kind} ${failure} cannot contribute pressure confirmations`, () => {
      const snapshot = structuredClone(recovered);
      const observation = kind === "market" ? snapshot.market : snapshot.optionsPressure;
      snapshot.optionsPressure.activityHistoryPercentile = 0.99;
      snapshot.optionsPressure.feedbackDemandObserved = true;
      if (failure === "stale-status") observation.status = "STALE";
      else for (const source of snapshot.sources.filter((item) => item.kind === kind)) {
        source.effectiveAt = failure === "old-effective-date" ? "2020-01-01T00:00:00Z" : null;
      }
      const derived = deriveEvidenceInputs(snapshot);
      assert.equal(kind === "market" ? derived.market.abnormalVolume : derived.options.callActivityElevated, null);
      assert.ok(classifySnapshot(derived).level < 2);
    });
  }
}
test("missing observations cannot be classified as ordinary dormant trading", () => {
  assert.throws(() => classifySnapshot(deriveEvidenceInputs({})), /state is unknown/);
});
