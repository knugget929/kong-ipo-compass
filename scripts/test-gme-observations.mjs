import assert from "node:assert/strict";
import test from "node:test";
import { parseCboeOptions, parseNasdaqHistory, parseNasdaqQuote } from "./fetch-gme-observations.mjs";

test("Nasdaq quote normalization rejects missing fields", () => {
  assert.throws(() => parseNasdaqQuote({ data: { primaryData: {} } }), /missing price/);
});

test("Nasdaq quote normalization preserves observed values", () => {
  const result = parseNasdaqQuote({ data: { primaryData: { lastSalePrice: "$24.04", percentageChange: "+5.62%", volume: "14,851,250" } } });
  assert.deepEqual({ last: result.last, changePct: result.changePct, volume: result.volume }, { last: 24.04, changePct: 5.62, volume: 14851250 });
});

test("Nasdaq after-hours response preserves the regular-session close", () => {
  const result = parseNasdaqQuote({ data: {
    marketStatus: "After-Hours",
    primaryData: { lastSalePrice: "$24.15", percentageChange: "+0.46%", volume: "14,888,860.6" },
    secondaryData: { lastSalePrice: "$24.04", percentageChange: "+5.62%" },
  } });
  assert.equal(result.last, 24.04);
  assert.equal(result.changePct, 5.62);
  assert.equal(result.volume, 14888861);
  assert.equal(result.extendedHoursLast, 24.15);
});

test("history derives a reference volume without changing observations", () => {
  const rows = Array.from({ length: 5 }, (_, index) => ({ date: `09/${20 - index}/2026`, close: `$${20 + index}`, volume: `${(index + 1) * 1000}` }));
  const result = parseNasdaqHistory({ data: { tradesTable: { rows } } });
  assert.equal(result.referenceAverageVolume, 3000);
  assert.equal(result.observations.length, 5);
});

test("Cboe normalization separates calls and puts without inferring hedging", () => {
  const result = parseCboeOptions({
    data: {
      current_price: 24.1254,
      options: [
        { option: "GME260925C00024000", volume: 100, open_interest: 80, iv: .67 },
        { option: "GME260925P00024000", volume: 25, open_interest: 40, iv: .71 },
      ],
    },
    timestamp: "2026-09-22 20:36:42",
  });
  assert.equal(result.selectedCallVolume, 100);
  assert.equal(result.selectedPutVolume, 25);
  assert.equal(result.concentrations[0].strike, 24);
  assert.equal(result.nearMoneyCallVolumeShare, 1);
  assert.equal(result.missingVolumeContracts, 0);
});

test("Cboe normalization preserves missing fields instead of converting them to zero", () => {
  const result = parseCboeOptions({
    data: {
      current_price: 24.1254,
      options: [
        { option: "GME260925C00024000", volume: null, open_interest: 80, iv: .67 },
        { option: "GME260925P00024000", volume: 25, open_interest: null, iv: .71 },
      ],
    },
    timestamp: "2026-09-22 20:36:42",
  });
  assert.equal(result.selectedCallVolume, null);
  assert.equal(result.selectedPutOpenInterest, null);
  assert.equal(result.missingVolumeContracts, 1);
  assert.equal(result.missingOpenInterestContracts, 1);
});
