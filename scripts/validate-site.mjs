import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(path, "utf8");
const [root, kong, gme, gmeScript, current, fallback, health, healthFallback, history, historyFallback, events, eventsFallback] = await Promise.all([
  read("dist/index.html"),
  read("dist/kong/index.html"),
  read("dist/gme/index.html"),
  read("dist/gme/gme.js"),
  read("data/gme/current.json"),
  read("dist/data/gme/current.json"),
  read("data/gme/health.json"),
  read("dist/data/gme/health.json"),
  read("data/gme/history/2026-09-22.json"),
  read("dist/data/gme/history/2026-09-22.json"),
  read("data/gme/events/index.json"),
  read("dist/data/gme/events/index.json"),
]);

assert.equal(kong, root, "/kong must preserve the deployed Kong shell byte-for-byte");
assert.match(kong, /Kong IPO Compass/, "/kong must identify the Kong product");
assert.match(gme, /GME Short Squeeze Watch/, "/gme must identify the GME product");
assert.match(gme, /id="state"/, "/gme must expose the current state first");
assert.match(gme, /id="evidence"/, "/gme must expose evidence drill-down");
assert.match(gmeScript, /REMOTE_ROOT/, "GME client must attempt canonical runtime data");
assert.match(gmeScript, /Site snapshot fallback/, "GME client must label fallback behavior");
assert.match(gmeScript, /computedFreshness/, "GME client must age evidence at render time");
assert.match(gmeScript, /eventItems/, "GME history must load preserved material events");
assert.match(gme, /data-edge="catalyst-market"/, "causal field paths must be data-driven");
assert.equal(fallback, current, "deploy-time GME fallback must match canonical current data");
assert.equal(healthFallback, health, "deploy-time health fallback must match canonical update health");
assert.equal(historyFallback, history, "deploy-time history fallback must match canonical immutable snapshot");
assert.equal(eventsFallback, events, "deploy-time event fallback must match canonical event index");

console.log("Static Site routes and canonical/fallback data are consistent.");
