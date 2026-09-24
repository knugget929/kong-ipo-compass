import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { validateBundle } from './gme-validation.mjs';
export function loadFiles(root='data/gme') {
  return Object.fromEntries(fs.readdirSync(root,{recursive:true}).filter(p=>p.endsWith('.json')).map(p=>['data/gme/'+p,JSON.parse(fs.readFileSync(root+'/'+p,'utf8'))]));
}
const files=loadFiles(); validateBundle(files);
// A supplied baseline guards immutable history even for structural/release work.
const base=process.argv[2];
if(base) {
  const paths=execFileSync('git',['ls-tree','-r','--name-only',base,'--','data/gme/history','data/gme/events/items'],{encoding:'utf8'}).trim().split('\n').filter(p=>p && !p.endsWith('/index.json'));
  for(const path of paths) {
    const bytes=execFileSync('git',['show',`${base}:${path}`]);
    if(!fs.existsSync(path)||!bytes.equals(fs.readFileSync(path))) throw new Error(`Immutable file changed: ${path}`);
  }
}
console.log(`GME canonical data valid: ${files['data/gme/current.json'].state.key}; all history/events resolve and reproduce.`);
