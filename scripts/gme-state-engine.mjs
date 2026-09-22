const LEVELS = Object.freeze([
  "DORMANT",
  "ATTENTION",
  "PRESSURE",
  "REFLEXIVE",
  "SQUEEZE",
  "DISLOCATION",
]);

const STATE_LABELS = Object.freeze({
  DORMANT: "Dormant",
  ATTENTION: "Attention",
  PRESSURE: "Pressure building",
  REFLEXIVE: "Reflexive",
  SQUEEZE: "Squeeze",
  DISLOCATION: "Dislocation",
});

function truthyCount(values) {
  return values.filter((value) => value === true).length;
}

function known(value) {
  return value === true || value === false;
}

function anyTrueElseUnknown(values) {
  if (values.some((value) => value === true)) return true;
  if (values.every((value) => value === false)) return false;
  return null;
}

export const DERIVATION_RULES = Object.freeze({
  marketVolumePercentile: 0.9,
  marketAbsoluteReturnPercentile: 0.9,
  shortPctSharesOutstanding: 20,
  shortChangeFromPriorPct: 5,
  shortMaximumAgeDays: 15,
  optionsActivityPercentile: 0.9,
  optionsNearMoneyCallVolumeShare: 0.2,
  catalystMaximumAgeDays: 3,
  materialSupplyShare: 0.1,
});

function ageDays(later, earlier) {
  const end = new Date(later).getTime();
  const start = new Date(earlier).getTime();
  if (!Number.isFinite(end) || !Number.isFinite(start)) return null;
  return Math.max(0, (end - start) / 86_400_000);
}

/** Recompute market metrics from the immutable session window. */
export function deriveMarketMetrics(market = {}) {
  const sessions = market.referenceSessions ?? [];
  const dayVolume = market.dayVolume ?? market.volume;
  const dayChangePct = market.dayChangePct ?? market.changePct;
  const valid = sessions.length >= 5 && sessions.every(
    (row) => row.date && Number.isFinite(row.close) && Number.isFinite(row.volume),
  );
  if (!valid || !Number.isFinite(dayVolume) || !Number.isFinite(dayChangePct)) {
    return {
      referenceAverageVolume: null,
      relativeVolume: null,
      volumePercentile20: null,
      absoluteReturnPercentile20: null,
      referenceWindowSessions: valid ? sessions.length : null,
    };
  }
  const referenceAverageVolume = sessions.reduce((sum, row) => sum + row.volume, 0) / sessions.length;
  const historicalAbsoluteReturns = sessions.slice(0, -1).map((row, index) => (
    Math.abs((row.close / sessions[index + 1].close - 1) * 100)
  ));
  return {
    referenceAverageVolume,
    relativeVolume: dayVolume / referenceAverageVolume,
    volumePercentile20: sessions.filter((row) => row.volume < dayVolume).length / sessions.length,
    absoluteReturnPercentile20: historicalAbsoluteReturns.length
      ? historicalAbsoluteReturns.filter((value) => value < Math.abs(dayChangePct)).length / historicalAbsoluteReturns.length
      : null,
    referenceWindowSessions: sessions.length,
  };
}

/**
 * Derive every state-engine input from dated, quantitative observations.
 * A null means the required evidence is unavailable; it is never converted to
 * false or to an apparently normal condition.
 */
export function deriveEvidenceInputs(snapshot) {
  const market = snapshot.market ?? {};
  const short = snapshot.shortPressure ?? {};
  const borrow = snapshot.borrowPressure ?? {};
  const options = snapshot.optionsPressure ?? {};
  const catalyst = snapshot.catalystPressure ?? {};
  const supply = snapshot.supplyPressure ?? {};
  const sourceById = new Map((snapshot.sources ?? []).map((source) => [source.id, source]));
  const observedAt = snapshot.observedAt;
  const shortAge = ageDays(observedAt, short.effectiveDate);
  const catalystDates = (catalyst.items ?? [])
    .filter((item) => (item.sourceIds ?? []).some((id) => (sourceById.get(id)?.tier ?? 99) <= 2))
    .map((item) => item.date)
    .filter(Boolean);
  const newestCatalystAge = catalystDates.length
    ? Math.min(...catalystDates.map((date) => ageDays(observedAt, date)).filter((value) => value !== null))
    : null;
  const issuedShareRatio = Number.isFinite(supply.recentNoteExchangeShares) && Number.isFinite(supply.sharesOutstanding)
    ? supply.recentNoteExchangeShares / supply.sharesOutstanding
    : null;
  const contingentShareRatio = Number.isFinite(supply.warrantSharesPotential) && Number.isFinite(supply.sharesOutstanding)
    ? supply.warrantSharesPotential / supply.sharesOutstanding
    : null;
  const issuanceAge = ageDays(observedAt, supply.recentNoteExchangeDate);
  const warrantExpiry = new Date(supply.warrantExpiry).getTime();
  const observedTime = new Date(observedAt).getTime();
  const warrantsActive = Number.isFinite(warrantExpiry) && Number.isFinite(observedTime)
    ? observedTime <= warrantExpiry + 86_400_000
    : null;

  const marketMetrics = deriveMarketMetrics(market);
  const abnormalVolume = Number.isFinite(marketMetrics.volumePercentile20)
    ? marketMetrics.volumePercentile20 >= DERIVATION_RULES.marketVolumePercentile
    : null;
  const priceAcceleration = Number.isFinite(marketMetrics.absoluteReturnPercentile20)
    ? marketMetrics.absoluteReturnPercentile20 >= DERIVATION_RULES.marketAbsoluteReturnPercentile
    : null;
  const materialDemandCatalyst = newestCatalystAge === null
    ? null
    : catalyst.status === "OBSERVED" && newestCatalystAge <= DERIVATION_RULES.catalystMaximumAgeDays;
  const issuedSupplyExpansion = issuedShareRatio === null || issuanceAge === null
    ? null
    : issuedShareRatio >= DERIVATION_RULES.materialSupplyShare && issuanceAge <= 30;
  const contingentSupplyExpansion = contingentShareRatio === null || warrantsActive === null
    ? null
    : contingentShareRatio >= DERIVATION_RULES.materialSupplyShare && warrantsActive;

  return {
    attention: {
      abnormal: anyTrueElseUnknown([abnormalVolume, priceAcceleration, materialDemandCatalyst]),
    },
    short: {
      positioningElevated: Number.isFinite(short.pctSharesOutstanding)
        ? short.pctSharesOutstanding >= DERIVATION_RULES.shortPctSharesOutstanding
        : null,
      positioningRising: Number.isFinite(short.changeFromPriorPct)
        ? short.changeFromPriorPct >= DERIVATION_RULES.shortChangeFromPriorPct
        : null,
      directCoveringEvidence: short.directCoveringEvidence ?? null,
      fresh: shortAge === null ? null : shortAge <= DERIVATION_RULES.shortMaximumAgeDays,
    },
    borrow: {
      stressed: borrow.status === "OBSERVED" ? (borrow.stressed ?? null) : null,
      fresh: borrow.status === "OBSERVED" ? (borrow.fresh ?? null) : null,
    },
    options: {
      callActivityElevated: Number.isFinite(options.activityHistoryPercentile)
        ? options.activityHistoryPercentile >= DERIVATION_RULES.optionsActivityPercentile
        : null,
      nearMoneyConcentration: Number.isFinite(options.nearMoneyCallVolumeShare)
        ? options.nearMoneyCallVolumeShare >= DERIVATION_RULES.optionsNearMoneyCallVolumeShare
        : null,
      feedbackDemandObserved: options.feedbackDemandObserved ?? null,
    },
    market: {
      abnormalVolume,
      priceAcceleration,
      severeDislocation: market.severeDislocationEvidence ?? null,
    },
    catalyst: { materialDemandCatalyst },
    supply: {
      expanding: anyTrueElseUnknown([issuedSupplyExpansion, contingentSupplyExpansion]),
    },
  };
}

/**
 * Deterministic, evidence-gated state classification.
 *
 * This is deliberately not a weighted score. Higher states require qualitatively
 * different evidence, so a large price move cannot accumulate its way into a
 * squeeze classification.
 */
export function deriveState(input) {
  const market = input.market ?? {};
  const short = input.short ?? {};
  const borrow = input.borrow ?? {};
  const options = input.options ?? {};
  const catalyst = input.catalyst ?? {};
  const supply = input.supply ?? {};

  const structuralConfirmations = truthyCount([
    short.positioningElevated === true && short.positioningRising === true && short.fresh === true,
    borrow.stressed === true && borrow.fresh === true,
    options.callActivityElevated && options.nearMoneyConcentration,
  ]);

  const demandConfirmations = truthyCount([
    market.abnormalVolume === true && market.priceAcceleration === true,
    catalyst.materialDemandCatalyst,
  ]);

  const freshShort = short.positioningElevated === true && short.fresh === true;
  const freshBorrow = borrow.stressed === true && borrow.fresh === true;
  const squeezePositioningGate = supply.expanding === true
    ? freshShort && freshBorrow
    : freshShort || freshBorrow;
  const squeezeGate =
    market.abnormalVolume === true &&
    short.directCoveringEvidence === true &&
    squeezePositioningGate;

  if (squeezeGate && market.severeDislocation === true) {
    return stateResult("DISLOCATION", [
      "direct covering evidence",
      "abnormal market activity",
      "exceptional price-formation or liquidity stress",
    ]);
  }

  if (squeezeGate) {
    return stateResult("SQUEEZE", [
      "direct covering evidence",
      "abnormal market activity",
      "stressed short positioning or borrow",
    ]);
  }

  const reflexiveGate =
    market.abnormalVolume === true &&
    options.callActivityElevated === true &&
    options.nearMoneyConcentration === true &&
    options.feedbackDemandObserved === true &&
    structuralConfirmations >= (supply.expanding === true ? 3 : 2);

  if (reflexiveGate) {
    return stateResult("REFLEXIVE", [
      "abnormal market activity",
      "observed options concentration",
      "observed feedback demand",
      "multiple structural confirmations",
    ]);
  }

  if (
    market.abnormalVolume === true &&
    structuralConfirmations >= (supply.expanding === true ? 3 : 2) &&
    demandConfirmations >= 2
  ) {
    return stateResult("PRESSURE", [
      "abnormal market activity",
      "multiple independent structural confirmations",
      "more than one demand-side confirmation",
    ]);
  }

  if (
    demandConfirmations >= 1 ||
    structuralConfirmations >= 1 ||
    input.attention?.abnormal === true ||
    catalyst.materialDemandCatalyst === true
  ) {
    return stateResult("ATTENTION", [
      "an abnormal or thesis-relevant observation",
      "insufficient independent confirmation for pressure",
    ]);
  }

  return stateResult("DORMANT", [
    "no material demand anomaly",
    "no independently confirmed positioning stress",
  ]);
}

function stateResult(key, gates) {
  return {
    key,
    level: LEVELS.indexOf(key),
    label: STATE_LABELS[key],
    gates,
  };
}

export function deriveConfidence(input, state) {
  const coverage = [
    known(input.short?.positioningElevated),
    known(input.borrow?.stressed),
    known(input.options?.callActivityElevated),
    known(input.market?.abnormalVolume),
    known(input.catalyst?.materialDemandCatalyst),
    known(input.supply?.expanding),
  ].filter(Boolean).length;

  const staleStructural =
    input.short?.fresh === false || input.borrow?.fresh === false;
  const highStateWithoutDirectEvidence =
    state.level >= 3 &&
    input.short?.directCoveringEvidence !== true &&
    input.options?.feedbackDemandObserved !== true;

  if (coverage <= 3 || highStateWithoutDirectEvidence) {
    return {
      key: "LOW",
      label: "Low",
      reason: "Important mechanisms are unavailable or lack direct evidence.",
    };
  }

  if (coverage <= 5 || staleStructural) {
    return {
      key: "MEDIUM",
      label: "Medium",
      reason: staleStructural
        ? "Coverage is broad, but at least one structural signal is delayed or stale."
        : "One important mechanism remains unavailable.",
    };
  }

  return {
    key: "HIGH",
    label: "High",
    reason: "All six mechanisms have current, directly observed inputs.",
  };
}

export function classifySnapshot(input) {
  const state = deriveState(input);
  return { ...state, confidence: deriveConfidence(input, state) };
}

export const SQUEEZE_LEVELS = LEVELS;
