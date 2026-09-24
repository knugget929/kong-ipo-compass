import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const script = fs.readFileSync(new URL('../dist/gme/gme.js', import.meta.url), 'utf8');
const current = JSON.parse(fs.readFileSync(new URL('../dist/data/gme/current.json', import.meta.url)));
const node = () => ({textContent:'', innerHTML:'', hidden:false, style:{}, dataset:{}, classList:{toggle(){}},setAttribute(){},addEventListener(){},replaceChildren(){}});
async function run(mode, change=()=>{}) {
  const nodes=new Map(), hidden=[node(),node()], requests=[];
  const document={getElementById(id){if(!nodes.has(id))nodes.set(id,node());return nodes.get(id)}, querySelector(){return node()},querySelectorAll(selector){return selector.includes('.pressure-field')?hidden:[]}};
  const fetch=async(url)=>{
    requests.push(url); if(mode==='failed'||(mode==='fallback'&&url.startsWith('https:')))throw Error('network failure');
    const relative=url.slice(url.indexOf('/data/gme')+1);
    const data=JSON.parse(fs.readFileSync(new URL('../dist/'+relative, import.meta.url)));
    if(relative==='data/gme/current.json')change(data);
    return {ok:true,json:async()=>data};
  };
  const NativeDate=Date;
  class FixedDate extends NativeDate {static now(){return NativeDate.parse(current.observedAt)}};
  vm.runInNewContext(script,{document,fetch,Date:FixedDate,Intl,URL,AbortController,window:{setTimeout,clearTimeout},console:{error(){}}});
  for(let i=0;i<15;i++) await new Promise(resolve=>setImmediate(resolve));
  return {nodes,hidden,requests};
}
test('canonical bundle renders six engines and source links',async()=>{
 const {nodes,requests}=await run('canonical');
 assert.match(nodes.get('dataCondition').textContent,/Canonical/);
 assert.equal((nodes.get('engineGrid').innerHTML.match(/<article class="engine-card /g)||[]).length,6);
 assert.match(nodes.get('sourceLedger').innerHTML,/https:\/\//);
 assert.ok(requests.every(url=>url.includes('/main/data/gme/')));
});
test('network failure uses explicitly labelled complete snapshot fallback',async()=>{
 const {nodes}=await run('fallback');assert.equal(nodes.get('dataCondition').textContent,'Site snapshot fallback');
});
test('total evidence failure displays unknown, never a fabricated stage',async()=>{
 const {nodes,hidden}=await run('failed');assert.equal(nodes.get('stateLevel').textContent,'STATE UNKNOWN');assert.equal(nodes.get('stateLabel').textContent,'Unavailable');assert.ok(hidden.every(n=>n.hidden));
});
test('one old effective feed cannot be masked by a recent retrieved feed',async()=>{
 const {nodes}=await run('canonical',data=>{data.sources.find(s=>s.kind==='options').effectiveAt='2020-01-01T00:00:00Z'});
 assert.match(nodes.get('dataCondition').textContent,/Evidence aged/);
 assert.match(nodes.get('stateLevel').textContent,/LAST SNAPSHOT/);
 assert.equal(nodes.get('confidenceChip').textContent,'Current confidence unavailable');
 assert.match(nodes.get('sourceLedger').innerHTML,/old · stale/);
});
test('invalid canonical source URL causes validated local fallback',async()=>{
 let changed=false;const {nodes}=await run('canonical',data=>{if(!changed){data.sources[0].url='javascript:alert(1)';changed=true;}});
 assert.equal(nodes.get('dataCondition').textContent,'Site snapshot fallback');
});
