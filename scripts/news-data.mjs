import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

export const DECISIONS = ['UPGRADE', 'MAINTAIN', 'DOWNGRADE'];
export const IMPACTS = ['positive', 'neutral', 'negative'];
export const SIGNIFICANCE = ['high', 'meaningful', 'noted'];
export const RUN_STATUSES = ['NO_MATERIAL_CHANGE', 'MATERIAL_CHANGE'];
export const MAX_CHECK_SUMMARY_LENGTH = 1200;

export const isValidDate = (value) => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)
  && !Number.isNaN(new Date(value.length === 10 ? `${value}T12:00:00Z` : value).getTime());
export const isValidTimestamp = (value) => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  && !Number.isNaN(new Date(value).getTime());

const requireString = (value, message) => assert.ok(typeof value === 'string' && value.trim(), message);
const requireHttpsSource = (source, label) => {
  assert.ok(source && typeof source === 'object', `${label} source must be an object`);
  requireString(source.label, `${label} source label is required`);
  assert.equal(new URL(source.url).protocol, 'https:', `${label} sources must use HTTPS`);
};

const PROHIBITED_PRIVATE_KEYS = new Set([
  'password', 'passwd', 'secret', 'apikey', 'token', 'accesstoken', 'refreshtoken',
  'credential', 'credentials', 'authorization', 'cookie', 'cookies', 'privatekey',
  'message', 'messages', 'email', 'emails', 'holding', 'holdings',
  'personalholdings', 'privateholdings', 'privateresearch', 'researchnotes', 'privatenotes',
  'privatemessage', 'privatemessages', 'accountnumber', 'accountid'
]);
const PERSONAL_INPUT_KEYS = new Set(['ownedshares', 'costbasis']);
const normalizeKey = (key) => key.toLowerCase().replace(/[^a-z0-9]/g, '');

export function assertNoProhibitedPrivateFields(value, label = 'record', { allowPersonalModelInputs = false } = {}) {
  const visit = (node, fieldPath) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach((entry, index) => visit(entry, `${fieldPath}[${index}]`));
      return;
    }
    for (const [key, child] of Object.entries(node)) {
      const normalized = normalizeKey(key);
      const prohibited = PROHIBITED_PRIVATE_KEYS.has(normalized)
        || (!allowPersonalModelInputs && PERSONAL_INPUT_KEYS.has(normalized));
      assert.ok(!prohibited, `${label} contains prohibited/private field ${fieldPath}.${key}`);
      visit(child, `${fieldPath}.${key}`);
    }
  };
  visit(value, label);
}

export function validateNewsItem(record, label = 'news item') {
  assertNoProhibitedPrivateFields(record, label);
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
  assertNoProhibitedPrivateFields(record, label);
  assert.equal(record.schemaVersion, 1, `${label} schema version must be supported`);
  assert.ok(Number.isInteger(record.revision) && record.revision > 0, `${label} revision must be positive`);
  assert.ok(Number.isInteger(record.historyLimit) && record.historyLimit > 0 && record.historyLimit <= 30, `${label} history limit must be between 1 and 30`);
  assert.ok(Array.isArray(record.items), `${label} items must be an array`);
  assert.ok(record.items.length <= record.historyLimit, `${label} exceeds history limit`);
  const ids = new Set();
  let prior = null;
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
    const current = new Date(item.publishedAt.length === 10 ? `${item.publishedAt}T12:00:00Z` : item.publishedAt).getTime();
    if (prior !== null) assert.ok(current <= prior, `${label} must be newest first`);
    prior = current;
  }
}

export function validateCheckState(record, label = 'latest check') {
  assertNoProhibitedPrivateFields(record, label);
  assert.equal(record.schemaVersion, 1, `${label} schema version must be supported`);
  assert.ok(Number.isInteger(record.revision) && record.revision > 0, `${label} revision must be positive`);
  assert.ok(isValidTimestamp(record.lastCheckedAt), `${label} check time must be a valid ISO timestamp`);
  assert.ok(RUN_STATUSES.includes(record.status), `${label} status is invalid`);
  assert.ok(DECISIONS.includes(record.thesisDecision), `${label} thesis decision is invalid`);
  requireString(record.summary, `${label} summary is required`);
  assert.ok(record.summary.length <= MAX_CHECK_SUMMARY_LENGTH, `${label} summary must be concise (<= ${MAX_CHECK_SUMMARY_LENGTH} characters)`);
  if (record.execution !== undefined) assert.ok(record.execution && typeof record.execution === 'object' && !Array.isArray(record.execution), `${label} execution metadata must be an object`);
}

export function validateThesisRecord(record, label = 'thesis') {
  assertNoProhibitedPrivateFields(record, label, { allowPersonalModelInputs: true });
  assert.equal(record.schemaVersion, 1, `${label} schema version must be supported`);
  assert.ok(Number.isInteger(record.revision) && record.revision > 0, `${label} revision must be positive`);
  assert.ok(record.verdict && record.model?.defaults && record.model?.presets, `${label} model is incomplete`);
  assert.ok(isValidTimestamp(record.updatedAt), `${label} update time must be a valid ISO timestamp`);
  assert.ok(isValidDate(record.asOf), `${label} as-of date must be a parseable ISO date`);
  assert.ok(Array.isArray(record.scorecard) && record.scorecard.length > 0, `${label} scorecard is required`);
  assert.equal(record.scorecard.reduce((sum, item) => sum + item.score, 0), record.verdict.score, `${label} scorecard must equal verdict score`);
  assert.ok(Array.isArray(record.sources) && Array.isArray(record.changeLog), `${label} evidence collections are required`);
  for (const entry of record.changeLog) {
    assert.ok(isValidDate(entry.date), `${label} change-log dates must be parseable ISO dates`);
    if (entry.verdict !== undefined) assert.ok(DECISIONS.includes(entry.verdict), `${label} change-log verdict is invalid`);
  }
  assert.equal(record.model.defaults.ownedShares, 0, `${label} must not expose personal holdings`);
  assert.equal(record.model.defaults.costBasis, 0, `${label} must not expose personal cost basis`);
  for (const field of ['arr', 'multiple', 'netCash', 'dilutedShares', 'ipoDiscount']) {
    assert.ok(Number.isFinite(record.model.defaults[field]), `${label} default ${field} must be finite`);
    for (const preset of ['bear', 'base', 'bull']) assert.ok(Number.isFinite(record.model.presets[preset][field]), `${label} ${preset} ${field} must be finite`);
  }
  for (const source of record.sources) requireHttpsSource(source, label);
}

const INDEX_FIELDS = ['id', 'publishedAt', 'title', 'impact', 'significance', 'thesisDecision', 'scoreDelta'];
const sameIndexMetadata = (entry, item) => INDEX_FIELDS.every((field) => Object.is(entry[field], item[field]));

export function validateNewsDataset({ index, check, itemsById }, label = 'canonical news') {
  validateNewsIndex(index, `${label} index`);
  validateCheckState(check, `${label} check`);
  assert.ok(itemsById instanceof Map, `${label} itemsById must be a Map`);
  for (const [id, item] of itemsById) {
    validateNewsItem(item, `${label} item ${id}`);
    assert.equal(item.id, id, `${label} item filename/id mismatch for ${id}`);
  }
  for (const entry of index.items) {
    const item = itemsById.get(entry.id);
    assert.ok(item, `${label} index references missing item ${entry.id}`);
    assert.ok(sameIndexMetadata(entry, item), `${label} index metadata does not match item ${entry.id}`);
  }
  const indexed = new Set(index.items.map((item) => item.id));
  const orphanIds = [...itemsById.keys()].filter((id) => !indexed.has(id)).sort();
  return { orphanIds };
}

const sameSet = (left, right) => left.size === right.size && [...left].every((value) => right.has(value));
const assertRevisionIncrement = (before, after, label) => assert.equal(after.revision, before.revision + 1, `${label} revision must increment by exactly 1`);
const cloneComparableEntries = (itemsById) => [...itemsById.entries()];

function validateMaterialIndexTransition(beforeIndex, afterIndex, newId) {
  assertRevisionIncrement(beforeIndex, afterIndex, 'news index');
  assert.equal(afterIndex.historyLimit, beforeIndex.historyLimit, 'routine runs must not change news historyLimit');
  const beforeIds = beforeIndex.items.map((item) => item.id);
  const afterIds = afterIndex.items.map((item) => item.id);
  assert.equal(afterIds.filter((id) => id === newId).length, 1, 'new material item must appear exactly once in the index');
  const retainedOldIds = afterIds.filter((id) => id !== newId);
  const expectedRetainedOldIds = beforeIds.slice(0, Math.max(0, afterIndex.historyLimit - 1));
  assert.deepEqual(retainedOldIds, expectedRetainedOldIds, 'existing historical IDs must be preserved except tail aging required by historyLimit');
}

function validateThesisTransition(beforeThesis, afterThesis, newItem, check) {
  validateThesisRecord(afterThesis, 'candidate thesis');
  assertRevisionIncrement(beforeThesis, afterThesis, 'thesis');
  assert.equal(afterThesis.asOf, afterThesis.updatedAt.slice(0, 10), 'thesis asOf must match updatedAt date');
  assert.equal(afterThesis.changeLog.length, beforeThesis.changeLog.length + 1, 'thesis change must add exactly one dated change-log entry');
  assert.deepEqual(afterThesis.changeLog.slice(1), beforeThesis.changeLog, 'thesis change must preserve prior change-log history');
  const change = afterThesis.changeLog[0];
  assert.equal(change.date, afterThesis.asOf, 'new thesis change-log date must match thesis asOf');
  assert.equal(change.verdict, check.thesisDecision, 'new thesis change-log verdict must match the run thesisDecision');
  requireString(change.headline, 'new thesis change-log headline is required');
  requireString(change.detail, 'new thesis change-log detail is required');

  const priorSources = new Map(beforeThesis.sources.map((source) => [source.url, source]));
  for (const [url, source] of priorSources) {
    const retained = afterThesis.sources.find((candidate) => candidate.url === url);
    assert.deepEqual(retained, source, `thesis change must preserve existing source ${url}`);
  }
  const beforeUrls = new Set(beforeThesis.sources.map((source) => source.url));
  const newItemUrls = new Set(newItem.sources.map((source) => source.url));
  const newEvidenceUrls = afterThesis.sources
    .map((source) => source.url)
    .filter((url) => newItemUrls.has(url) && !beforeUrls.has(url));
  assert.ok(newEvidenceUrls.length > 0, 'thesis change must add at least one HTTPS source from the newly recorded material item');
}

export function validateScheduledWriteTransition({ before, after, changedPaths }, label = 'scheduled write') {
  assert.ok(before && after, `${label} requires before and after state`);
  assert.ok(Array.isArray(changedPaths), `${label} changedPaths must be an array`);
  const changed = new Set(changedPaths);
  assert.equal(changed.size, changedPaths.length, `${label} changedPaths must not contain duplicates`);
  const alwaysForbidden = [...changed].filter((file) => file === 'data/news.json' || file.startsWith('dist/data/'));
  assert.deepEqual(alwaysForbidden, [], `${label} must not change frozen data/news.json or dist/data/*`);

  validateNewsDataset(before.news, 'baseline split news');
  validateNewsDataset(after.news, 'candidate split news');
  validateThesisRecord(before.thesis, 'baseline thesis');
  validateThesisRecord(after.thesis, 'candidate thesis');

  const itemPaths = [...changed].filter((file) => /^data\/news\/items\/[a-z0-9][a-z0-9-]*\.json$/.test(file));
  const hasIndex = changed.has('data/news/index.json');
  const hasCheck = changed.has('data/checks/latest.json');
  const hasThesis = changed.has('data/thesis.json');
  assert.ok(hasCheck, `${label} must update data/checks/latest.json`);

  if (itemPaths.length === 0) {
    const expected = new Set(['data/checks/latest.json']);
    assert.ok(sameSet(changed, expected), 'no-material-news run may change only data/checks/latest.json');
    assertRevisionIncrement(before.news.check, after.news.check, 'latest check');
    assert.equal(after.news.check.status, 'NO_MATERIAL_CHANGE', 'no-material-news run must use NO_MATERIAL_CHANGE status');
    assert.deepEqual(after.news.index, before.news.index, 'no-material-news run must not change news index');
    assert.deepEqual(cloneComparableEntries(after.news.itemsById), cloneComparableEntries(before.news.itemsById), 'no-material-news run must not change news items');
    assert.deepEqual(after.thesis, before.thesis, 'no-material-news run must not change thesis');
    return { pattern: 'NO_MATERIAL_NEWS' };
  }

  assert.equal(itemPaths.length, 1, 'routine material-news run must create exactly one new item file');
  assert.ok(hasIndex, 'material-news run must update data/news/index.json');
  const expected = new Set(['data/checks/latest.json', 'data/news/index.json', itemPaths[0], ...(hasThesis ? ['data/thesis.json'] : [])]);
  assert.ok(sameSet(changed, expected), 'material-news run contains unexpected changed paths');
  assertRevisionIncrement(before.news.check, after.news.check, 'latest check');
  assert.equal(after.news.check.status, 'MATERIAL_CHANGE', 'material-news run must use MATERIAL_CHANGE status');

  const filenameId = path.basename(itemPaths[0], '.json');
  assert.ok(!before.news.itemsById.has(filenameId), 'routine material-news run must not overwrite an existing item');
  const newItem = after.news.itemsById.get(filenameId);
  assert.ok(newItem, `candidate state must contain new item ${filenameId}`);
  assert.equal(newItem.id, filenameId, 'new item stable ID must match filename');
  assert.equal(newItem.revision, 1, 'new material item must begin at revision 1');
  assert.equal(after.news.itemsById.size, before.news.itemsById.size + 1, 'routine run must add exactly one item and delete none');
  for (const [id, item] of before.news.itemsById) {
    assert.ok(after.news.itemsById.has(id), `routine run must preserve historical item ${id}`);
    assert.deepEqual(after.news.itemsById.get(id), item, `routine run must not rewrite historical item ${id}`);
  }

  validateMaterialIndexTransition(before.news.index, after.news.index, filenameId);
  assert.equal(after.news.check.thesisDecision, newItem.thesisDecision, 'latest check decision must match the newly recorded material item');

  if (hasThesis) {
    validateThesisTransition(before.thesis, after.thesis, newItem, after.news.check);
    return { pattern: 'MATERIAL_NEWS_THESIS_CHANGED', newItemId: filenameId };
  }
  assert.deepEqual(after.thesis, before.thesis, 'material-news run without thesis change must leave thesis byte-for-byte equivalent');
  return { pattern: 'MATERIAL_NEWS_THESIS_UNCHANGED', newItemId: filenameId };
}

export async function readNewsDataset(root = 'data') {
  const index = JSON.parse(await readFile(path.join(root, 'news/index.json'), 'utf8'));
  const check = JSON.parse(await readFile(path.join(root, 'checks/latest.json'), 'utf8'));
  const itemDir = path.join(root, 'news/items');
  const files = (await readdir(itemDir)).filter((name) => name.endsWith('.json')).sort();
  const itemsById = new Map();
  for (const filename of files) {
    const id = filename.slice(0, -5);
    const item = JSON.parse(await readFile(path.join(itemDir, filename), 'utf8'));
    itemsById.set(id, item);
  }
  return { index, check, itemsById };
}
