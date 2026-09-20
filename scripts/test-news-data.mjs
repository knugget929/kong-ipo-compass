import assert from 'node:assert/strict';
import test from 'node:test';
import { validateNewsDataset } from './news-data.mjs';

const source={label:'Example source',url:'https://example.com/source'};
const makeItem=(id='2026-09-20-example',publishedAt='2026-09-20',overrides={})=>({
  schemaVersion:1, revision:1, id, publishedAt, title:'Example material development',
  impact:'positive', significance:'meaningful', thesisDecision:'MAINTAIN', scoreDelta:0,
  summary:'A concise material-news summary.', confirmed:['Confirmed fact.'], uncertain:['Remaining uncertainty.'],
  sources:[source], ...overrides
});
const meta=(item)=>Object.fromEntries(['id','publishedAt','title','impact','significance','thesisDecision','scoreDelta'].map((key)=>[key,item[key]]));
const makeDataset=()=>{
  const item=makeItem();
  return {
    index:{schemaVersion:1,revision:1,historyLimit:30,items:[meta(item)]},
    check:{schemaVersion:1,revision:1,lastCheckedAt:'2026-09-20T04:00:00+03:00',status:'NO_MATERIAL_CHANGE',thesisDecision:'MAINTAIN',summary:'No material thesis change.'},
    itemsById:new Map([[item.id,item]])
  };
};

test('valid migrated data',()=>assert.doesNotThrow(()=>validateNewsDataset(makeDataset())));
test('duplicate IDs are rejected',()=>{
  const data=makeDataset(); data.index.items.push({...data.index.items[0]});
  assert.throws(()=>validateNewsDataset(data),/duplicate id/);
});
test('missing indexed item is rejected',()=>{
  const data=makeDataset(); data.itemsById.clear();
  assert.throws(()=>validateNewsDataset(data),/missing item/);
});
test('valid orphan item is retained but not indexed',()=>{
  const data=makeDataset(); const orphan=makeItem('2026-09-19-orphan','2026-09-19');
  data.itemsById.set(orphan.id,orphan);
  assert.deepEqual(validateNewsDataset(data).orphanIds,[orphan.id]);
});
test('invalid source and significance are rejected',()=>{
  const badSource=makeDataset(); badSource.itemsById.get('2026-09-20-example').sources=[{label:'bad',url:'http://example.com'}];
  assert.throws(()=>validateNewsDataset(badSource),/HTTPS/);
  const badSignificance=makeDataset(); badSignificance.itemsById.get('2026-09-20-example').significance='viral';
  assert.throws(()=>validateNewsDataset(badSignificance),/significance/);
});
test('max-history behavior rejects an oversized index',()=>{
  const data=makeDataset(); data.index.historyLimit=2;
  const second=makeItem('2026-09-19-second','2026-09-19');
  const third=makeItem('2026-09-18-third','2026-09-18');
  data.index.items=[meta(data.itemsById.values().next().value),meta(second),meta(third)];
  data.itemsById.set(second.id,second); data.itemsById.set(third.id,third);
  assert.throws(()=>validateNewsDataset(data),/exceeds history limit/);
});
test('no-news run-state update leaves news history untouched',()=>{
  const data=makeDataset(); const beforeIndex=structuredClone(data.index); const beforeItems=[...data.itemsById.entries()].map(([id,item])=>[id,structuredClone(item)]);
  data.check={...data.check,revision:2,lastCheckedAt:'2026-09-20T05:00:00+03:00',summary:'Fresh check; still no material change.'};
  assert.doesNotThrow(()=>validateNewsDataset(data));
  assert.deepEqual(data.index,beforeIndex); assert.deepEqual([...data.itemsById.entries()],beforeItems);
});
test('material-news addition validates when item exists before it is indexed',()=>{
  const data=makeDataset(); const fresh=makeItem('2026-09-21-new-material','2026-09-21',{thesisDecision:'UPGRADE',scoreDelta:2,significance:'high'});
  data.itemsById.set(fresh.id,fresh);
  assert.deepEqual(validateNewsDataset(data).orphanIds,[fresh.id]);
  data.index={...data.index,revision:2,items:[meta(fresh),...data.index.items]};
  data.check={...data.check,revision:2,status:'MATERIAL_CHANGE',thesisDecision:'UPGRADE',summary:'New material evidence added.'};
  assert.deepEqual(validateNewsDataset(data).orphanIds,[]);
});
test('thesis can remain byte-for-byte unchanged when evidence does not warrant a change',()=>{
  const thesis={revision:4,verdict:{score:69,direction:'Constructive'}}; const before=structuredClone(thesis);
  const data=makeDataset(); const fresh=makeItem('2026-09-21-maintain','2026-09-21',{thesisDecision:'MAINTAIN',scoreDelta:0});
  data.itemsById.set(fresh.id,fresh); data.index={...data.index,revision:2,items:[meta(fresh),...data.index.items]};
  data.check={...data.check,revision:2,status:'MATERIAL_CHANGE',summary:'Material context, no thesis change.'};
  assert.doesNotThrow(()=>validateNewsDataset(data));
  assert.deepEqual(thesis,before);
});
