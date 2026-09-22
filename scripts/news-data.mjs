import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

export const DECISIONS = ['UPGRADE', 'MAINTAIN', 'DOWNGRADE'];
export const IMPACTS = ['positive', 'neutral', 'negative'];
export const SIGNIFICANCE = ['high', 'meaningful', 'noted'];

export const isValidDate = (value) => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)
  && !Number.isNaN(new Date(value.length === 10 ? `${value}T12:00:00Z` : value).getTime());

const requireString = (value, message) => assert.ok(typeof value === 'string' && value.trim(), message);
const requireHttpsSource = (source, label) => {
  assert.ok(source && typeof source === 'object', `${label} source must be an object`);
  requireString(source.label, `${label} source label is required`);
  assert.equal(new URL(source.url).protocol, 'https:', `${label} sources must use HTTPS`);
};

export function validateNewsItem(record, label = 'news item') {
  assert.equal(record.schemaVersion, 1, `${label} schema version must be supported`);
  assert.ok(Number.isInteger(record.revision) && record.revision > 0, `${label} revision must be positive`);
  requireString(record.id, `${label} id is required`);
  assert.match(record.id, /^[a-z0-9][a-z0-9-]*$/, `${label} id must be filename-safe`);
  assert.ok(isValidDate(record.publishedAt), `${label} publication date must be parseable`);
  requireString(record.title, `${label} title is required`);
  requireString(record.summary, `${label} summary is required`);
  assert.ok(IMPACTS.includes(record.impact), `${label} impact is invalid`);
  assert.ok(SIGNIFICANCE.includes(record.significance), `${label} significance is invalid`);
  assert.ok(DECISIONS.includes(record.thesisDecision), `${label} thesis decision is invalid`);
  assert.ok(Number.isFinite(record.scoreDelta), `${label} score delta must be finite`);
  assert.ok(Array.isArray(record.confirmed), `${label} confirmed facts must be an array`);
  assert.ok(Array.isArray(record.uncertain), `${label} uncertainty must be an array`);
  assert.ok(record.confirmed.every((value) => typeof value === 'string' && value.trim()), `${label} confirmed facts must be strings`);
  assert.ok(record.uncertain.every((value) => typeof value === 'string' && value.trim()), `${label} uncertainty entries must be strings`);
  assert.ok(Array.isArray(record.sources) && record.sources.length > 0, `${label} must have a source`);
  record.sources.forEach((source) => requireHttpsSource(source, label));
}

export function validateNewsIndex(record, label = 'news index') {
  assert.equal(record.schemaVersion, 1, `${label} schema version must be supported`);
  assert.ok(Number.isInteger(record.revision) && record.revision > 0, `${label} revision must be positive`);
  assert.ok(Number.isInteger(record.historyLimit) && record.historyLimit > 0 && record.historyLimit <= 30, `${label} history limit must be between 1 and 30`);
  assert.ok(Array.isArray(record.items), `${label} items must be an array`);
  assert.ok(record.items.length <= record.historyLimit, `${label} exceeds history limit`);
  const ids=new Set();
  let prior=null;
  for (const item of record.items) {
    requireString(item.id, `${label} item id is required`);
    assert.ok(!ids.has(item.id), `${label} contains duplicate id ${item.id}`);
    ids.add(item.id);
    assert.ok(isValidDate(item.publishedAt), `${label} publication date must be parseable`);
    requireString(item.title, `${label} item title is required`);
    assert.ok(IMPACTS.includes(item.impact), `${label} item impact is invalid`);
    assert.ok(SIGNIFICANCE.includes(item.significance), `${label} item significance is invalid`);
    assert.ok(DECISIONS.includes(item.thesisDecision), `${label} item decision is invalid`);
    assert.ok(Number.isFinite(item.scoreDelta), `${label} item score delta must be finite`);
    const current=new Date(item.publishedAt.length===10 ? `${item.publishedAt}T12:00:00Z` : item.publishedAt).getTime();
    if (prior !== null) assert.ok(current <= prior, `${label} must be newest first`);
    prior=current;
  }
}

export function validateCheckState(record, label = 'latest check') {
  assert.equal(record.schemaVersion, 1, `${label} schema version must be supported`);
  assert.ok(Number.isInteger(record.revision) && record.revision > 0, `${label} revision must be positive`);
  assert.ok(isValidDate(record.lastCheckedAt), `${label} check time must be parseable`);
  requireString(record.status, `${label} status is required`);
  assert.match(record.status, /^[A-Z][A-Z0-9_]*$/, `${label} status must be uppercase snake case`);
  assert.ok(DECISIONS.includes(record.thesisDecision), `${label} thesis decision is invalid`);
  requireString(record.summary, `${label} summary is required`);
  if (record.execution !== undefined) assert.ok(record.execution && typeof record.execution === 'object' && !Array.isArray(record.execution), `${label} execution metadata must be an object`);
}

const INDEX_FIELDS=['id','publishedAt','title','impact','significance','thesisDecision','scoreDelta'];
const sameIndexMetadata=(entry,item)=>INDEX_FIELDS.every((field)=>Object.is(entry[field],item[field]));

export function validateNewsDataset({ index, check, itemsById }, label = 'canonical news') {
  validateNewsIndex(index, `${label} index`);
  validateCheckState(check, `${label} check`);
  assert.ok(itemsById instanceof Map, `${label} itemsById must be a Map`);
  for (const [id,item] of itemsById) {
    validateNewsItem(item, `${label} item ${id}`);
    assert.equal(item.id,id,`${label} item filename/id mismatch for ${id}`);
  }
  for (const entry of index.items) {
    const item=itemsById.get(entry.id);
    assert.ok(item, `${label} index references missing item ${entry.id}`);
    assert.ok(sameIndexMetadata(entry,item), `${label} index metadata does not match item ${entry.id}`);
  }
  const indexed=new Set(index.items.map((item)=>item.id));
  const orphanIds=[...itemsById.keys()].filter((id)=>!indexed.has(id)).sort();
  return { orphanIds };
}

export async function readNewsDataset(root='data') {
  const index=JSON.parse(await readFile(path.join(root,'news/index.json'),'utf8'));
  const check=JSON.parse(await readFile(path.join(root,'checks/latest.json'),'utf8'));
  const itemDir=path.join(root,'news/items');
  const files=(await readdir(itemDir)).filter((name)=>name.endsWith('.json')).sort();
  const itemsById=new Map();
  for (const filename of files) {
    const id=filename.slice(0,-5);
    const item=JSON.parse(await readFile(path.join(itemDir,filename),'utf8'));
    itemsById.set(id,item);
  }
  return { index, check, itemsById };
}
