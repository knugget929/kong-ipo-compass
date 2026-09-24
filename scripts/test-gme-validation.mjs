import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateBundle, validateScheduledTransition, ROOT } from './gme-validation.mjs';
import { classifySnapshot, deriveEvidenceInputs } from './gme-state-engine.mjs';
const base=Object.fromEntries(fs.readdirSync('dist/data/gme',{recursive:true}).filter(p=>p.endsWith('.json')).map(p=>[ROOT+p,JSON.parse(fs.readFileSync('dist/'+ROOT+p))]));
const clone=structuredClone;
// Stable deployment fixture, independent of canonical scheduled updates.
const nextAt=new Date(Date.parse(base[ROOT+'current.json'].observedAt)+86400000).toISOString();
const nextDate=nextAt.slice(0,10);
const oldDate=base[ROOT+'current.json'].snapshotDate;
function check(after,before=base,extra={}) { const blobs=Object.fromEntries(Object.keys(before).map(p=>[p,'a'.repeat(40)])); return validateScheduledTransition({before,after,baselineHead:'b'.repeat(40),actualHead:'b'.repeat(40),baselineBlobs:blobs,actualBlobs:blobs,...extra}); }
function routine() {
 const after=clone(base), s=after[ROOT+'current.json'], h=after[ROOT+'health.json'];
 const at=nextAt; s.revision++;s.observedAt=at;s.snapshotDate=at.slice(0,10);
 const source=clone(s.sources.find(s=>s.kind==='market')); source.id='market-refresh-2026-09-23'; source.observedAt=at; s.sources.push(source);
 s.engineInputs=deriveEvidenceInputs(s); const computed=classifySnapshot(s.engineInputs);
 s.state={...s.state,...computed,previous:base[ROOT+'current.json'].state.key,transitionKind:'ROUTINE_UPDATE'};s.thesisDirection='MATERIALLY_UNCHANGED';
 h.lastAttemptAt=at;h.lastSuccessfulSnapshotAt=at;h.runKind='ROUTINE_UPDATE';h.summary='Routine public source check';
 after[ROOT+'history/'+s.snapshotDate+'.json']={schemaVersion:1,recordKind:'DAILY_THESIS_SNAPSHOT',capturedAt:at,...clone(s)};
 const hi=after[ROOT+'history/index.json'];hi.updatedAt=at;hi.entries.unshift({date:s.snapshotDate,state:s.state.key,previousState:s.state.previous,transitionKind:s.state.transitionKind,thesisDirection:s.thesisDirection,title:'Routine check',snapshot:s.snapshotDate+'.json',importantEventIds:[]});
 return after;
}
function degraded() {const a=clone(base),h=a[ROOT+'health.json'];h.lastAttemptAt=new Date(Date.parse(nextAt)+86400000).toISOString();h.runKind='ROUTINE_UPDATE';h.summary='Provider retrieval failed; last evidence preserved';h.providers[0].status='FAILED';return a;}
function event(a=clone(base)) {const e=clone(a[ROOT+'events/items/2026-09-21-cohen-purchase.json']);e.id='2026-09-23-test-event';a[ROOT+'events/items/'+e.id+'.json']=e;return a;}
test('canonical complete dataset including historical baseline validates',()=>validateBundle(base));
test('valid future routine observation needs no material event',()=>assert.equal(check(routine()),'ROUTINE_UPDATE'));
test('valid provider-degraded health-only update preserves old evidence',()=>assert.equal(check(degraded()),'PROVIDER_DEGRADED'));
for(const timestamp of ['yesterday','09/24/2026','2026-09-24T04:00:00','2026-02-30T04:00:00Z']) test('reject malformed timestamp '+timestamp,()=>{const a=degraded();a[ROOT+'health.json'].lastAttemptAt=timestamp;assert.throws(()=>check(a));});
test('invalid state is rejected',()=>{const a=routine();a[ROOT+'current.json'].state.key='MOON';assert.throws(()=>check(a));});
test('state inconsistent with derived inputs rejected',()=>{const a=routine();a[ROOT+'current.json'].state.key='SQUEEZE';a[ROOT+'current.json'].state.level=4;assert.throws(()=>check(a));});
test('missing history snapshot rejected',()=>{const a=routine();delete a[ROOT+'history/'+nextDate+'.json'];assert.throws(()=>check(a));});
test('missing event item rejected',()=>{const a=clone(base);delete a[ROOT+'events/items/2026-09-21-cohen-purchase.json'];assert.throws(()=>validateBundle(a));});
test('duplicate event ID rejected',()=>{const a=clone(base);a[ROOT+'events/index.json'].items.push(a[ROOT+'events/index.json'].items[0]);assert.throws(()=>validateBundle(a));});
test('safe valid unindexed event can be staged',()=>assert.equal(check(event()),'STAGED_EVENT'));
test('invalid public source rejected',()=>{const a=routine();a[ROOT+'current.json'].sources[0].url='http://example.com';assert.throws(()=>check(a));});
test('unresolved engine source rejected',()=>{const a=routine();a[ROOT+'current.json'].engines[0].sourceIds.push('missing');assert.throws(()=>check(a));});
test('historical snapshot overwrite rejected',()=>{const a=degraded();a[ROOT+'history/'+oldDate+'.json'].interpretation='changed';assert.throws(()=>check(a));});
test('historical event deletion rejected',()=>{const a=degraded();delete a[ROOT+'events/items/2026-09-03-note-exchange.json'];assert.throws(()=>check(a));});
for(const path of ['dist/data/gme/health.json','dist/gme/gme.js','.github/workflows/run.yml','data/news.json']) test('prohibited routine path '+path,()=>{const a=degraded();a[path]={};assert.throws(()=>check(a));});
for(const key of ['api_key','privateResearch','OwnedShares','privateMessages']) test('private field '+key,()=>{const a=degraded();a[ROOT+'health.json'][key]='private';assert.throws(()=>check(a));});
test('concurrent head rejected',()=>assert.throws(()=>check(degraded(),base,{actualHead:'c'.repeat(40)})));
test('concurrent blob rejected',()=>assert.throws(()=>check(degraded(),base,{actualBlobs:{}})));
test('failed provider cannot freshen success time',()=>{const a=degraded();a[ROOT+'health.json'].providers[0].lastSuccessAt=a[ROOT+'health.json'].lastAttemptAt;assert.throws(()=>check(a));});
test('failed borrow observation cannot be replaced by normal',()=>{const a=routine();a[ROOT+'current.json'].borrowPressure.stressed=false;assert.throws(()=>check(a));});
test('no hard-coded history date: future complete bundle validates',()=>validateBundle(routine()));
test('valid material event plus new index entry',()=>{
 const a=event(routine()),s=a[ROOT+'current.json'],e=a[ROOT+'events/items/2026-09-23-test-event.json'];
 e.occurredAt=s.observedAt;e.stateBefore=s.state.previous;e.stateAfter=s.state.key;e.sourceIds=['market-refresh-2026-09-23'];
 const {id,occurredAt,type,category,title}=e;a[ROOT+'events/index.json'].items.unshift({id,occurredAt,type,category,title,path:`items/${id}.json`});a[ROOT+'events/index.json'].updatedAt=s.observedAt;
 s.state.transitionKind='MATERIAL_THESIS_EVENT';a[ROOT+'health.json'].runKind=s.state.transitionKind;
 a[ROOT+'history/'+nextDate+'.json']={recordKind:'DAILY_THESIS_SNAPSHOT',capturedAt:s.observedAt,...clone(s)};a[ROOT+'history/index.json'].entries[0].transitionKind=s.state.transitionKind;
 assert.equal(check(a),'MATERIAL_THESIS_EVENT');
});
for(const [label,mutate] of [
 ['missing interpretation',s=>delete s.interpretation],
 ['missing source freshness',s=>delete s.sources[0].freshness],
 ['misleading state label',s=>s.state.label='Squeeze'],
 ['misleading confidence label',s=>s.state.confidence.label='High'],
 ['missing thesis supports',s=>delete s.theses[0].supports],
 ['invalid forward list',s=>s.next.forward='text'],
]) test('renderer compatibility rejects '+label,()=>{const a=routine();mutate(a[ROOT+'current.json']);assert.throws(()=>check(a));});
test('valid state transition from evidence aging is reproducible without a fabricated event',()=>{
 const a=routine(),s=a[ROOT+'current.json']; delete a[ROOT+'history/'+nextDate+'.json'];
 s.observedAt=new Date(Date.parse(nextAt)+10*86400000).toISOString();s.snapshotDate=s.observedAt.slice(0,10);s.sources.at(-1).observedAt=s.observedAt;
 s.engineInputs=deriveEvidenceInputs(s); s.state={...s.state,...classifySnapshot(s.engineInputs),transitionKind:'STATE_TRANSITION'};
 assert.notEqual(s.state.key,base[ROOT+'current.json'].state.key);
 const h=a[ROOT+'health.json'];h.lastAttemptAt=s.observedAt;h.lastSuccessfulSnapshotAt=s.observedAt;h.runKind='STATE_TRANSITION';
 a[ROOT+'history/'+s.snapshotDate+'.json']={recordKind:'DAILY_THESIS_SNAPSHOT',capturedAt:s.observedAt,...clone(s)};
 const hi=a[ROOT+'history/index.json'];hi.updatedAt=s.observedAt;Object.assign(hi.entries[0],{date:s.snapshotDate,snapshot:s.snapshotDate+'.json',state:s.state.key,transitionKind:'STATE_TRANSITION'});
 assert.equal(check(a),'STATE_TRANSITION');
});
