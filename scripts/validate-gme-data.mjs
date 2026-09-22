import assert from "node:assert/strict";
import { classifySnapshot, deriveEvidenceInputs, deriveMarketMetrics, SQUEEZE_LEVELS } from "./gme-state-engine.mjs";
import {
  assertEnum,
  assertIso,
  assertSource,
  readJson,
} from "./gme-data.mjs";

const current = readJson("data/gme/current.json");
const history = readJson("data/gme/history/index.json");
const events = readJson("data/gme/events/index.json");
const health = readJson("data/gme/health.json");

assert.equal(current.schemaVersion, 1, "current schemaVersion must be 1");
assert.equal(current.symbol, "GME", "current symbol must be GME");
assertIso(current.observedAt, "current.observedAt");
assertEnum(current.state.key, SQUEEZE_LEVELS, "current.state.key");
assertEnum(
  current.thesisDirection,
  ["STRENGTHENED", "WEAKENED", "MATERIALLY_UNCHANGED", "INITIAL_BASELINE"],
  "current.thesisDirection",
);

for (const status of [
  current.market.status,
  current.shortPressure.status,
  current.borrowPressure.status,
  current.optionsPressure.status,
  current.catalystPressure.status,
  current.supplyPressure.status,
]) {
  assertEnum(
    status,
    ["OBSERVED", "INFERRED", "ESTIMATED", "STALE", "UNAVAILABLE", "CONFLICTING", "NOT_APPLICABLE"],
    "engine status",
  );
}

assert.equal(current.engines.length, 6, "exactly six engine summaries are required");
assert.equal(current.theses.length, 3, "exactly three competing theses are required");
assert.ok(current.whatChanged.strengthening.length, "strengthening evidence is required");
assert.ok(current.whatChanged.weakening.length, "weakening evidence is required");
assert.ok(current.whatChanged.unknown.length, "unknown evidence is required");
assert.ok(current.next.forward.length, "forward conditions are required");
assert.ok(current.next.backward.length, "backward conditions are required");
assert.ok(current.falsifiers.length, "falsifiers are required");
assert.ok(current.upcomingCatalysts.length, "known catalyst map is required");

const sourceIds = new Set();
for (const [index, source] of current.sources.entries()) {
  assertSource(source, `current.sources[${index}]`);
  assert.ok(!sourceIds.has(source.id), `duplicate source id: ${source.id}`);
  sourceIds.add(source.id);
}

for (const engine of current.engines) {
  for (const sourceId of engine.sourceIds) {
    assert.ok(sourceIds.has(sourceId), `${engine.key} references missing source ${sourceId}`);
  }
}

const derivedInputs = deriveEvidenceInputs(current);
const derivedMarket = deriveMarketMetrics(current.market);
assert.deepEqual(
  {
    referenceAverageVolume: current.market.referenceAverageVolume,
    relativeVolume: current.market.relativeVolume,
    volumePercentile20: current.market.volumePercentile20,
    absoluteReturnPercentile20: current.market.absoluteReturnPercentile20,
    referenceWindowSessions: current.market.referenceWindowSessions,
  },
  derivedMarket,
  "stored market metrics must be reproducible from the immutable session window",
);
assert.deepEqual(
  current.engineInputs,
  derivedInputs,
  "stored engine inputs must be reproducible from dated observations",
);
const computed = classifySnapshot(derivedInputs);
assert.deepEqual(
  { key: current.state.key, level: current.state.level },
  { key: computed.key, level: computed.level },
  "stored state must match deterministic state engine",
);
assert.equal(
  current.state.confidence.key,
  computed.confidence.key,
  "stored confidence must match deterministic coverage/freshness logic",
);

assert.equal(history.schemaVersion, 1, "history schemaVersion must be 1");
assert.ok(history.entries.length >= 1, "history must include at least one canonical snapshot");
assert.equal(history.entries[0].snapshot, "2026-09-22.json");
for (const entry of history.entries) {
  const snapshot = readJson(`data/gme/history/${entry.snapshot}`);
  assert.equal(snapshot.recordKind, "DAILY_THESIS_SNAPSHOT", `${entry.snapshot} must be a canonical daily snapshot`);
  assert.equal(snapshot.state.key, entry.state, `${entry.snapshot} state must match history index`);
  assert.ok(snapshot.sources?.length, `${entry.snapshot} must preserve sources`);
  assert.equal(snapshot.engines?.length, 6, `${entry.snapshot} must preserve all engines`);
  assert.equal(snapshot.theses?.length, 3, `${entry.snapshot} must preserve competing theses`);
  assert.ok(snapshot.whatChanged && snapshot.next && snapshot.falsifiers?.length, `${entry.snapshot} must be reconstructable`);
}

assert.equal(events.schemaVersion, 1, "event schemaVersion must be 1");
assert.ok(events.items.length >= 3, "event index must include primary catalyst/supply events");
for (const item of events.items) {
  assert.ok(item.id && item.path && item.occurredAt, "event index item is incomplete");
  assertIso(item.occurredAt, `${item.id}.occurredAt`);
}

assert.equal(health.schemaVersion, 1, "health schemaVersion must be 1");
assertEnum(health.status, ["OK", "DEGRADED", "FAILED"], "health.status");
assertIso(health.lastAttemptAt, "health.lastAttemptAt");
assertIso(health.lastSuccessfulSnapshotAt, "health.lastSuccessfulSnapshotAt");
assert.ok(health.providers.some((provider) => provider.status === "UNAVAILABLE_EXPECTED"), "known coverage gaps must be explicit in health");

console.log(
  `GME data valid: ${current.state.key} (${current.state.confidence.key.toLowerCase()} confidence), ${current.sources.length} sources, ${events.items.length} events.`,
);
