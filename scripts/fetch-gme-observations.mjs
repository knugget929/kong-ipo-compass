#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { deriveMarketMetrics } from "./gme-state-engine.mjs";

const USER_AGENT = "GME-Thesis-Watch/1.0 evidence-research";
const symbol = "GME";

function numberFrom(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const normalized = value.replace(/[$,%+,]/g, "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseNasdaqQuote(payload) {
  const primary = payload?.data?.primaryData ?? {};
  const secondary = payload?.data?.secondaryData ?? {};
  const marketStatus = payload?.data?.marketStatus ?? "Unknown";
  const useRegularClose = marketStatus !== "Market Open" && numberFrom(secondary.lastSalePrice) !== null;
  const regular = useRegularClose ? secondary : primary;
  const volume = numberFrom(primary.volume ?? secondary.volume);
  const last = numberFrom(regular.lastSalePrice ?? regular.lastSalePriceValue);
  const changePct = numberFrom(regular.percentageChange);
  if (last === null || volume === null || changePct === null) {
    throw new Error("Nasdaq quote response is missing price, volume, or percentage change");
  }
  return {
    provider: "Nasdaq",
    observedAt: new Date().toISOString(),
    last,
    changePct,
    volume: Math.round(volume),
    marketStatus,
    extendedHoursLast: useRegularClose ? numberFrom(primary.lastSalePrice) : null,
    rawStatus: payload?.status?.rCode ?? null,
  };
}

export function parseNasdaqHistory(payload) {
  const rows = payload?.data?.tradesTable?.rows ?? [];
  const observations = rows.map((row) => ({
    date: row.date,
    close: numberFrom(row.close),
    volume: numberFrom(row.volume),
  })).filter((row) => row.date && row.close !== null && row.volume !== null);
  if (observations.length < 5) throw new Error("Nasdaq history response has fewer than five usable sessions");
  const referenceRows = observations.slice(0, 20);
  const referenceAverageVolume = referenceRows.reduce((sum, row) => sum + row.volume, 0) / referenceRows.length;
  return { observations, referenceAverageVolume };
}

function parseOccSymbol(optionSymbol) {
  const match = String(optionSymbol ?? "").match(/^GME(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/);
  if (!match) return null;
  const [, year, month, day, type, strikeRaw] = match;
  return {
    expiration: `20${year}-${month}-${day}`,
    type: type === "C" ? "CALL" : "PUT",
    strike: Number(strikeRaw) / 1000,
  };
}

export function parseCboeOptions(payload) {
  const quote = payload?.data ?? {};
  const timestamp = payload?.timestamp ?? quote.timestamp;
  const observedAt = timestamp ? new Date(`${timestamp.replace(" ", "T")}Z`).toISOString() : new Date().toISOString();
  const underlying = numberFrom(quote.current_price ?? quote.underlying_price);
  const options = (quote.options ?? []).map((row) => {
    const contract = parseOccSymbol(row.option);
    if (!contract) return null;
    return {
      ...contract,
      volume: numberFrom(row.volume),
      openInterest: numberFrom(row.open_interest),
      impliedVolatility: numberFrom(row.iv),
    };
  }).filter(Boolean);
  if (underlying === null || !options.length) throw new Error("Cboe response is missing the underlying or option contracts");

  const expirations = [...new Set(options.map((option) => option.expiration))].sort().slice(0, 6);
  const selected = options.filter((option) => expirations.includes(option.expiration));
  const sum = (contracts, type, field) => {
    const values = contracts.filter((item) => item.type === type).map((item) => item[field]);
    return values.length && values.every(Number.isFinite)
      ? values.reduce((total, value) => total + value, 0)
      : null;
  };
  const expirationSummary = expirations.map((expiration) => {
    const contracts = selected.filter((item) => item.expiration === expiration);
    return {
      date: expiration,
      callVolume: sum(contracts, "CALL", "volume"),
      putVolume: sum(contracts, "PUT", "volume"),
      callOpenInterest: sum(contracts, "CALL", "openInterest"),
      putOpenInterest: sum(contracts, "PUT", "openInterest"),
    };
  });
  const concentrations = selected
    .filter((item) => item.type === "CALL" && Number.isFinite(item.volume) && Math.abs(item.strike - underlying) <= Math.max(5, underlying * .25))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 8);
  const callVolume = sum(selected, "CALL", "volume");
  const nearMoneyCallVolume = selected
    .filter((item) => item.type === "CALL" && Number.isFinite(item.volume) && Math.abs(item.strike - underlying) <= 1.25)
    .reduce((total, item) => total + item.volume, 0);

  return {
    provider: "Cboe",
    observedAt,
    underlying,
    expirations,
    expirationSummary,
    selectedCallVolume: callVolume,
    selectedPutVolume: sum(selected, "PUT", "volume"),
    selectedCallOpenInterest: sum(selected, "CALL", "openInterest"),
    selectedPutOpenInterest: sum(selected, "PUT", "openInterest"),
    nearMoneyCallVolume,
    nearMoneyCallVolumeShare: Number.isFinite(callVolume) && callVolume > 0 ? nearMoneyCallVolume / callVolume : null,
    missingVolumeContracts: selected.filter((item) => item.volume === null).length,
    missingOpenInterestContracts: selected.filter((item) => item.openInterest === null).length,
    concentrations,
  };
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { "user-agent": USER_AGENT, accept: "application/json" } });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.json();
}

function dateForQuery(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export async function fetchObservations() {
  const today = new Date();
  const from = new Date(today);
  from.setUTCDate(from.getUTCDate() - 48);
  const [quotePayload, historyPayload, optionsPayload] = await Promise.all([
    fetchJson(`https://api.nasdaq.com/api/quote/${symbol}/info?assetclass=stocks`),
    fetchJson(`https://api.nasdaq.com/api/quote/${symbol}/historical?assetclass=stocks&fromdate=${dateForQuery(from)}&limit=30`),
    fetchJson(`https://cdn.cboe.com/api/global/delayed_quotes/options/${symbol}.json`),
  ]);
  const market = parseNasdaqQuote(quotePayload);
  const history = parseNasdaqHistory(historyPayload);
  const options = parseCboeOptions(optionsPayload);
  const referenceSessions = history.observations.slice(0, 20);
  const derivedMarket = deriveMarketMetrics({ ...market, referenceSessions });
  return {
    schemaVersion: 1,
    kind: "GME_OBSERVATION_CANDIDATE",
    generatedAt: new Date().toISOString(),
    market: {
      ...market,
      ...derivedMarket,
      referenceSessions,
    },
    options,
    boundaries: {
      dealerHedgingObserved: false,
      shortCoveringObserved: false,
      note: "This candidate contains observations and deterministic calculations only. It cannot infer dealer hedging or short covering.",
    },
  };
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  fetchObservations()
    .then((result) => process.stdout.write(`${JSON.stringify(result, null, 2)}\n`))
    .catch((error) => {
      console.error(`GME observation fetch failed: ${error.message}`);
      process.exitCode = 1;
    });
}
