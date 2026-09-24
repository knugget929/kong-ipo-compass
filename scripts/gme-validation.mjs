import assert from 'node:assert/strict';
import { isDeepStrictEqual as equal } from 'node:util';
import { assertIso, assertSource } from './gme-data.mjs';
import { deriveEvidenceInputs, deriveMarketMetrics, classifySnapshot, SQUEEZE_LEVELS } from './gme-state-engine.mjs';

export const ROOT = 'data/gme/';
const statuses = ['OBSERVED','INFERRED','ESTIMATED','STALE','UNAVAILABLE','CONFLICTING','NOT_APPLICABLE'];
const engineFields = {short:'shortPressure',borrow:'borrowPressure',options:'optionsPressure',market:'market',catalyst:'catalystPressure',supply:'supplyPressure'};
const directions = ['STRENGTHENED','WEAKENED','MATERIALLY_UNCHANGED','INITIAL_BASELINE'];
const kinds = ['INITIAL_BASELINE','ROUTINE_UPDATE','MATERIAL_THESIS_EVENT','STATE_TRANSITION'];
const prohibited = new Set('password passwd secret apikey token accesstoken refreshtoken credential credentials authorization cookie cookies privatekey message messages email emails holding holdings personalholdings privateholdings privateresearch researchnotes privatenotes privatemessage privatemessages accountnumber accountid ownedshares costbasis'.split(' '));
const nonempty = (s, label) => assert.ok(typeof s === 'string' && s.trim(), label);
const oneOf = (v, values, label) => assert.ok(values.includes(v), label);
const date = (s) => { assert.match(s, /^\d{4}-\d{2}-\d{2}$/); assert.equal(new Date(s).toISOString().slice(0,10), s); };
const unique = (xs, label) => assert.equal(new Set(xs).size, xs.length, label);
function publicRecord(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    assert.ok(!prohibited.has(key.toLowerCase().replace(/[^a-z0-9]/g,'')), `prohibited/private field: ${key}`);
    if (/^(observedAt|effectiveAt|publishedAt|capturedAt|updatedAt|occurredAt|lastAttemptAt|lastSuccessfulSnapshotAt|lastSuccessAt|sharesEffectiveAt)$/.test(key) && child !== null) assertIso(child, key);
    publicRecord(child);
  }
}
export function validateSnapshot(s) {
  publicRecord(s);
  assert.equal(s.schemaVersion,1); assert.equal(s.symbol,'GME');
  assert.ok(Number.isInteger(s.revision) && s.revision > 0);
  assertIso(s.observedAt,'observedAt'); date(s.snapshotDate);
  assert.equal(s.snapshotDate,s.observedAt.slice(0,10));
  oneOf(s.state.key,SQUEEZE_LEVELS,'invalid state');
  oneOf(s.state.transitionKind,kinds,'invalid transition kind');
  if(s.state.previous !== null) oneOf(s.state.previous,SQUEEZE_LEVELS,'invalid previous state');
  oneOf(s.thesisDirection,directions,'invalid thesis direction');
  for(const text of [s.interpretation,s.state.summary,s.state.confidence.reason,s.historicalComparison?.warning]) nonempty(text,'required display text');
  for(const key of ['forwardState','backwardState']) oneOf(s.next[key],SQUEEZE_LEVELS,'next state');
  assert.ok(Array.isArray(s.relationships)); for(const r of s.relationships) nonempty(r.label,'relationship label');
  for(const thesis of s.theses) { for(const field of ['label','assessment','fit','summary']) nonempty(thesis[field],`thesis ${field}`); for(const field of ['supports','contradictions']) { assert.ok(Array.isArray(thesis[field])); thesis[field].forEach(x=>nonempty(x,field)); } }
  assert.ok(Array.isArray(s.optionsPressure.concentrations)); for(const row of s.optionsPressure.concentrations) date(row.expiration);
  for(const c of s.upcomingCatalysts) { nonempty(c.certainty,'catalyst certainty'); if(c.date!==null) date(c.date); }

  assert.deepEqual(s.engines.map(x=>x.key).sort(),Object.keys(engineFields).sort(),'exactly six distinct engines');
  assert.deepEqual(s.theses.map(x=>x.key).sort(),['fundamental','normal','squeeze'],'exactly three competing theses');
  for(const key of ['strengthening','weakening','unchanged','unknown']) assert.ok(Array.isArray(s.whatChanged[key]));
  for(const xs of [s.next.forward,s.next.backward,s.falsifiers]) assert.ok(xs.length);
  assert.ok(Array.isArray(s.upcomingCatalysts));
  assert.ok(s.sources.length); unique(s.sources.map(x=>x.id),'duplicate source id');
  for(const source of s.sources) { assertSource(source,'source'); for(const key of ['freshness','kind','limitations']) nonempty(source[key],`source ${key}`); assert.ok(Date.parse(source.observedAt)<=Date.parse(s.observedAt),'source retrieved after snapshot'); }
  const ids=new Set(s.sources.map(x=>x.id));
  for(const engine of s.engines) {
    for(const key of ['label','condition','direction','headline','interpretation']) nonempty(engine[key],`engine ${key}`);
    oneOf(engine.status,statuses,'invalid engine status');
    oneOf(s[engineFields[engine.key]].status,statuses,'invalid observation status');
    assert.equal(engine.status,s[engineFields[engine.key]].status,'engine/observation status mismatch');
    for(const id of engine.sourceIds) assert.ok(ids.has(id),`missing source ${id}`);
  }
  for(const item of s.catalystPressure.items) { date(item.date); for(const id of item.sourceIds) assert.ok(ids.has(id),`missing catalyst source ${id}`); }
  date(s.shortPressure.effectiveDate);
  const metrics=deriveMarketMetrics(s.market);
  for(const [key,value] of Object.entries(metrics)) assert.deepEqual(s.market[key],value,`market metric ${key} not reproducible`);
  const inputs=deriveEvidenceInputs(s); assert.deepEqual(s.engineInputs,inputs,'inputs not reproducible');
  const state=classifySnapshot(inputs);
  assert.equal(s.state.label,state.label,'state label not reproducible');
  assert.equal(s.state.confidence.label,state.confidence.label,'confidence label not reproducible');
  assert.deepEqual([s.state.key,s.state.level,s.state.confidence.key],[state.key,state.level,state.confidence.key],'state not reproducible');
  return s;
}
export function validateHealth(h) {
  publicRecord(h); assert.equal(h.schemaVersion,1);
  oneOf(h.status,['OK','DEGRADED','FAILED'],'invalid health status');
  oneOf(h.runKind,kinds,'invalid health run kind');
  assertIso(h.lastAttemptAt,'lastAttemptAt'); assertIso(h.lastSuccessfulSnapshotAt,'lastSuccessfulSnapshotAt');
  assert.ok(Date.parse(h.lastAttemptAt)>=Date.parse(h.lastSuccessfulSnapshotAt)); nonempty(h.summary,'health summary');
  assert.deepEqual(h.providers.map(x=>x.key).sort(),['borrow','company','market','options','sec','short_interest']);
  for(const p of h.providers) {
    oneOf(p.status,['OK','STALE','FAILED','UNAVAILABLE','UNAVAILABLE_EXPECTED','CONFLICTING'],'provider status');
    if(p.lastSuccessAt!==null) { assertIso(p.lastSuccessAt,'lastSuccessAt'); assert.ok(Date.parse(p.lastSuccessAt)<=Date.parse(h.lastAttemptAt)); }
    if(p.status==='OK') assert.ok(p.lastSuccessAt);
  }
  if(h.providers.some(p=>p.status!=='OK')) assert.notEqual(h.status,'OK','coverage gaps cannot be healthy');
}
export function validateEvent(e,path,sourceIds) {
  publicRecord(e); assert.equal(e.schemaVersion,1); assert.match(e.id,/^[a-z0-9][a-z0-9-]*$/);
  assert.equal(path,`${ROOT}events/items/${e.id}.json`); assertIso(e.occurredAt,'event occurredAt');
  oneOf(e.type,['MATERIAL_THESIS_EVENT','STATE_TRANSITION'],'event type');
  oneOf(e.stateBefore,['UNRECORDED',...SQUEEZE_LEVELS],'stateBefore'); oneOf(e.stateAfter,['UNRECORDED',...SQUEEZE_LEVELS],'stateAfter');
  for(const key of ['category','title','mechanism','stateEffect']) nonempty(e[key],key);
  assert.ok(e.observations.length); for(const value of e.observations) nonempty(value,'event observation');
  assert.ok(e.sourceIds.length); for(const id of e.sourceIds) assert.ok(sourceIds.has(id),`event missing source ${id}`);
}
// files is a path -> parsed JSON map. Full validation includes every immutable file,
// including safe orphans; connector transitions reuse a trusted, recorded baseline.
export function validateBundle(files) {
  const current=validateSnapshot(files[ROOT+'current.json']); const health=files[ROOT+'health.json']; validateHealth(health);
  assert.equal(health.lastSuccessfulSnapshotAt,current.observedAt,'health must identify last valid observation');
  const history=files[ROOT+'history/index.json'], events=files[ROOT+'events/index.json'];
  for(const index of [history,events]) { publicRecord(index); assert.equal(index.schemaVersion,1); assertIso(index.updatedAt,'index updatedAt'); }
  assert.ok(history.entries.length); unique(history.entries.map(e=>e.date),'duplicate history date');
  const sourceIds=new Set(current.sources.map(s=>s.id));
  for(const [path,snapshot] of Object.entries(files).filter(([p])=>/^data\/gme\/history\/\d{4}-\d{2}-\d{2}\.json$/.test(p))) {
    validateSnapshot(snapshot); assert.equal(snapshot.recordKind,'DAILY_THESIS_SNAPSHOT'); assertIso(snapshot.capturedAt,'capturedAt');
    assert.equal(path,`${ROOT}history/${snapshot.snapshotDate}.json`);
    assert.equal(snapshot.capturedAt,snapshot.observedAt);
    for(const source of snapshot.sources) sourceIds.add(source.id);
  }
  for(let i=0;i<history.entries.length;i++) {
    const entry=history.entries[i]; date(entry.date); assert.equal(entry.snapshot,`${entry.date}.json`);
    const s=files[ROOT+'history/'+entry.snapshot]; assert.ok(s,`missing history snapshot ${entry.snapshot}`);
    for(const [field,value] of Object.entries({state:s.state.key,previousState:s.state.previous,transitionKind:s.state.transitionKind,thesisDirection:s.thesisDirection})) assert.equal(entry[field],value,`history ${field}`);
    if(i) assert.ok(history.entries[i-1].date>entry.date,'history ordering');
    assert.ok(Array.isArray(entry.importantEventIds));
  }
  assert.equal(history.entries[0].date,current.snapshotDate,'current date must be newest history date');
  unique(events.items.map(e=>e.id),'duplicate event ID');
  for(const [path,event] of Object.entries(files).filter(([p])=>p.startsWith(ROOT+'events/items/'))) validateEvent(event,path,sourceIds);
  for(let i=0;i<events.items.length;i++) {
    const item=events.items[i]; assert.equal(item.path,`items/${item.id}.json`);
    const event=files[ROOT+'events/'+item.path]; assert.ok(event,`missing event item ${item.id}`);
    for(const key of ['id','occurredAt','type','category','title']) assert.equal(item[key],event[key],`event index ${key}`);
    if(i) assert.ok(Date.parse(events.items[i-1].occurredAt)>=Date.parse(item.occurredAt),'event ordering');
  }
  const eventIds=new Set(events.items.map(e=>e.id));
  for(const entry of history.entries) for(const id of entry.importantEventIds) assert.ok(eventIds.has(id),`history event missing ${id}`);
  for(const item of current.catalystPressure.items) assert.ok(files[`${ROOT}events/items/${item.eventId}.json`],`catalyst event missing ${item.eventId}`);
  return true;
}

export function validateScheduledTransition({before,after,baselineHead,actualHead,baselineBlobs,actualBlobs}) {
  assert.match(baselineHead,/^[a-f0-9]{40}$/); assert.equal(actualHead,baselineHead,'concurrent branch change');
  assert.deepEqual(actualBlobs,baselineBlobs,'concurrent blob change');
  for(const p of Object.keys(before)) assert.match(baselineBlobs[p]??'',/^[a-f0-9]{40}$/,'missing baseline blob');
  const changed=[...new Set([...Object.keys(before),...Object.keys(after)])].filter(p=>!equal(before[p],after[p]));
  assert.ok(changed.length,'empty transition');
  const fixed=['current.json','health.json','history/index.json','events/index.json'].map(p=>ROOT+p);
  for(const p of changed) {
    assert.ok(fixed.includes(p)||/^data\/gme\/history\/\d{4}-\d{2}-\d{2}\.json$/.test(p)||/^data\/gme\/events\/items\/[a-z0-9][a-z0-9-]*\.json$/.test(p),`prohibited routine path ${p}`);
    assert.ok(after[p],`routine deletion ${p}`);
    if(!fixed.includes(p)) assert.ok(!before[p],`immutable overwrite ${p}`);
    publicRecord(after[p]);
  }
  validateBundle(after);
  const old=before[ROOT+'current.json'], next=after[ROOT+'current.json'];
  const oh=before[ROOT+'health.json'], nh=after[ROOT+'health.json'];
  if(changed.length===1 && changed[0].startsWith(ROOT+'events/items/')) return 'STAGED_EVENT';
  assert.ok(changed.includes(ROOT+'health.json'),'health required');
  assert.ok(Date.parse(nh.lastAttemptAt)>Date.parse(oh.lastAttemptAt),'attempt must advance');
  if(!changed.includes(ROOT+'current.json')) {
    assert.deepEqual(changed,[ROOT+'health.json'],'degraded refresh is health only');
    oneOf(nh.status,['DEGRADED','FAILED'],'degraded status'); assert.equal(nh.runKind,'ROUTINE_UPDATE');
    assert.equal(nh.lastSuccessfulSnapshotAt,oh.lastSuccessfulSnapshotAt);
    for(const p of nh.providers) assert.equal(p.lastSuccessAt,oh.providers.find(x=>x.key===p.key).lastSuccessAt,'health-only cannot invent successful observation');
    return 'PROVIDER_DEGRADED';
  }
  assert.equal(next.revision,old.revision+1); assert.ok(Date.parse(next.observedAt)>Date.parse(old.observedAt),'observation must advance');
  assert.equal(nh.lastSuccessfulSnapshotAt,next.observedAt);
  // Failed channels retain their entire previous evidence, dates and sources. A
  // refreshed run can coexist with an older failed feed, but cannot freshen it.
  const providerFields={market:['market'],options:['optionsPressure'],short_interest:['shortPressure'],borrow:['borrowPressure'],sec:['supplyPressure','catalystPressure'],company:['catalystPressure']};
  for(const p of nh.providers) if(p.status!=='OK') {
    assert.equal(p.lastSuccessAt,oh.providers.find(x=>x.key===p.key).lastSuccessAt,'failed provider last success changed');
    for(const field of providerFields[p.key]) assert.deepEqual(next[field],old[field],`failed provider evidence ${field}`);
  }
  for(const source of old.sources) {
    const retained=next.sources.find(x=>x.id===source.id);
    if(retained) assert.deepEqual(retained,source,'source ID is immutable; use fresh source IDs');
    const failed=nh.providers.some(p=>p.status!=='OK' && (p.key===source.kind || (p.key==='sec' && ['capital_structure','catalyst'].includes(source.kind))));
    if(failed) assert.deepEqual(retained,source,'failed source must remain unchanged');
  }
  for(const [field,key,kind,engine] of [['shortPressure','directCoveringEvidence','covering','short'],['optionsPressure','feedbackDemandObserved','dealer_feedback','options'],['market','severeDislocationEvidence','dislocation','market'],['borrowPressure','stressed','borrow','borrow'],['borrowPressure','fresh','borrow','borrow']]) {
    if(next[field][key]===true) assert.ok(next.sources.some(s=>s.kind===kind && s.freshness==='RECENT' && Date.parse(next.observedAt)-Date.parse(s.effectiveAt)>=0 && Date.parse(next.observedAt)-Date.parse(s.effectiveAt)<=4*86400000 && next.engines.find(e=>e.key===engine).sourceIds.includes(s.id)),`direct ${kind} evidence required`);
  }
  const newSources=next.sources.filter(s=>!old.sources.some(x=>x.id===s.id));
  assert.ok(newSources.some(s=>s.observedAt===next.observedAt),'observation refresh needs newly retrieved public evidence');
  const bh=before[ROOT+'history/index.json'], ah=after[ROOT+'history/index.json'];
  const snapshots=changed.filter(p=>/^data\/gme\/history\/\d/.test(p)); assert.ok(snapshots.length<=1);
  if(next.snapshotDate!==old.snapshotDate) {
    assert.equal(snapshots.length,1); assert.ok(changed.includes(ROOT+'history/index.json'));
    assert.deepEqual(ah.entries.slice(1),bh.entries,'history entries immutable');
    assert.equal(ah.updatedAt,next.observedAt);
    const {recordKind,capturedAt,...copy}=after[snapshots[0]]; assert.deepEqual(copy,next,'new daily snapshot must preserve current');
    assert.equal(capturedAt,next.observedAt); assert.equal(ah.entries[0].previousState,old.state.key);
  } else { assert.equal(snapshots.length,0); assert.deepEqual(ah,bh,'same-day snapshot/index immutable'); }
  assert.deepEqual(ah.retrospectiveRegimes,bh.retrospectiveRegimes,'retrospective history fixed');
  const be=before[ROOT+'events/index.json'], ae=after[ROOT+'events/index.json'];
  const added=ae.items.filter(e=>!be.items.some(b=>b.id===e.id)); assert.ok(added.length<=1);
  assert.deepEqual(ae.items.filter(e=>!added.some(a=>a.id===e.id)),be.items,'historical event entries immutable');
  const eventPaths=changed.filter(p=>p.startsWith(ROOT+'events/items/'));
  if(added.length) {
    assert.ok(eventPaths.length<=1); assert.equal(ae.updatedAt,next.observedAt);
    const event=after[ROOT+'events/'+added[0].path];
    assert.ok(event.sourceIds.some(id=>newSources.some(s=>s.id===id)),'material event needs fresh evidence');
    assert.equal(event.stateBefore,old.state.key); assert.equal(event.stateAfter,next.state.key);
    assert.equal(next.state.transitionKind,next.state.key!==old.state.key?'STATE_TRANSITION':'MATERIAL_THESIS_EVENT');
  } else { assert.deepEqual(ae,be); assert.equal(eventPaths.length,0); assert.equal(next.thesisDirection,'MATERIALLY_UNCHANGED'); }
  const transitioned=next.state.key!==old.state.key;
  assert.equal(next.state.previous,old.state.key); assert.equal(nh.runKind,next.state.transitionKind);
  if(transitioned) assert.equal(next.state.transitionKind,'STATE_TRANSITION');
  else if(!added.length) assert.equal(next.state.transitionKind,'ROUTINE_UPDATE');
  return transitioned?'STATE_TRANSITION':added.length?'MATERIAL_THESIS_EVENT':'ROUTINE_UPDATE';
}
