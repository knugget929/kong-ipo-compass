import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(path, "utf8");
const [root,kong,gme,gmeScript] = await Promise.all(['dist/index.html','dist/kong/index.html','dist/gme/index.html','dist/gme/gme.js'].map(read));

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
assert.match(gmeScript, /https:\/\/raw\.githubusercontent\.com\/knugget929\/kong-ipo-compass\/main\/data\/gme/, 'canonical source must be main');
// Fallback is independently valid, intentionally older after routine writes.
const { validateBundle } = await import('./gme-validation.mjs');
const fs = await import('node:fs');
const fallbackFiles = Object.fromEntries(fs.readdirSync('dist/data/gme',{recursive:true}).filter(p=>p.endsWith('.json')).map(p=>['data/gme/'+p,JSON.parse(fs.readFileSync('dist/data/gme/'+p,'utf8'))]));
validateBundle(fallbackFiles);
console.log('Static Site routes and independent deployment fallback are valid.');
