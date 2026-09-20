import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DECISIONS, IMPACTS, SIGNIFICANCE, isValidDate, readNewsDataset, validateNewsDataset } from './news-data.mjs';

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const thesis = await readJson('data/thesis.json');
const legacyNews = await readJson('data/news.json');
const thesisSnapshot = await readJson('dist/data/thesis.json');
const newsSnapshot = await readJson('dist/data/news.json');
const newsDataset = await readNewsDataset('data');

const validateThesis = (record, label) => {
  assert.equal(record.schemaVersion, 1, `${label} schema version must be supported`);
  assert.ok(Number.isInteger(record.revision) && record.revision > 0, `${label} revision must be positive`);
  assert.ok(record.verdict && record.model?.defaults && record.model?.presets, `${label} model is incomplete`);
  assert.ok(isValidDate(record.updatedAt), `${label} update time must be a parseable ISO date`);
  assert.ok(isValidDate(record.asOf), `${label} as-of date must be a parseable ISO date`);
  assert.ok(Array.isArray(record.scorecard) && record.scorecard.length > 0, `${label} scorecard is required`);
  assert.equal(record.scorecard.reduce((sum, item) => sum + item.score, 0), record.verdict.score, `${label} scorecard must equal verdict score`);
  assert.ok(Array.isArray(record.sources) && Array.isArray(record.changeLog), `${label} evidence collections are required`);
  for (const entry of record.changeLog) assert.ok(isValidDate(entry.date), `${label} change-log dates must be parseable ISO dates`);
  assert.equal(record.model.defaults.ownedShares, 0, `${label} must not expose personal holdings`);
  assert.equal(record.model.defaults.costBasis, 0, `${label} must not expose personal cost basis`);
  for (const field of ['arr', 'multiple', 'netCash', 'dilutedShares', 'ipoDiscount']) {
    assert.ok(Number.isFinite(record.model.defaults[field]), `${label} default ${field} must be finite`);
    for (const preset of ['bear', 'base', 'bull']) assert.ok(Number.isFinite(record.model.presets[preset][field]), `${label} ${preset} ${field} must be finite`);
  }
  for (const source of record.sources) assert.equal(new URL(source.url).protocol, 'https:', `${label} sources must use HTTPS`);
};

const validateLegacyNews = (record, label) => {
  assert.equal(record.schemaVersion, 1, `${label} schema version must be supported`);
  assert.ok(Number.isInteger(record.revision) && record.revision > 0, `${label} revision must be positive`);
  assert.ok(Array.isArray(record.items), `${label} items must be an array`);
  assert.ok(DECISIONS.includes(record.thesisDecision), `${label} thesis decision is invalid`);
  assert.ok(isValidDate(record.lastCheckedAt), `${label} check time must be a parseable ISO date`);
  assert.ok(typeof record.summary === 'string' && record.summary.trim(), `${label} summary is required`);
  for (const item of record.items) {
    assert.ok(item.id && item.publishedAt && item.title && item.summary, `${label} item is incomplete`);
    assert.ok(isValidDate(item.publishedAt), `${label} item publication dates must be parseable ISO dates`);
    assert.ok(DECISIONS.includes(item.thesisDecision), `${label} item decision is invalid`);
    assert.ok(IMPACTS.includes(item.impact), `${label} item impact is invalid`);
    assert.ok(SIGNIFICANCE.includes(item.significance), `${label} item significance is invalid`);
    assert.ok(Number.isFinite(item.scoreDelta), `${label} item score delta must be finite`);
    assert.ok(Array.isArray(item.confirmed) && Array.isArray(item.uncertain), `${label} fact boundaries are required`);
    assert.ok(Array.isArray(item.sources) && item.sources.length > 0, `${label} item must have a source`);
    for (const source of item.sources) assert.equal(new URL(source.url).protocol, 'https:', `${label} item sources must use HTTPS`);
  }
};

validateThesis(thesis, 'canonical thesis');
const { orphanIds } = validateNewsDataset(newsDataset, 'canonical split news');
validateLegacyNews(legacyNews, 'legacy canonical news compatibility snapshot');
validateThesis(thesisSnapshot, 'deployed thesis snapshot');
validateLegacyNews(newsSnapshot, 'deployed news snapshot');

assert.equal(thesisSnapshot.schemaVersion, thesis.schemaVersion, 'snapshot and canonical thesis schemas must match');
assert.equal(newsSnapshot.schemaVersion, legacyNews.schemaVersion, 'snapshot and legacy canonical news schemas must match');
assert.equal(newsDataset.index.schemaVersion, legacyNews.schemaVersion, 'split and legacy canonical news schemas must match');
assert.ok(thesisSnapshot.revision <= thesis.revision, 'deployed thesis snapshot cannot be newer than canonical data');
assert.ok(newsSnapshot.revision <= legacyNews.revision, 'deployed news snapshot cannot be newer than legacy canonical data');
assert.ok(newsDataset.index.revision >= legacyNews.revision, 'split news index cannot predate the migration compatibility snapshot');

for (const legacyItem of legacyNews.items) {
  const migrated=newsDataset.itemsById.get(legacyItem.id);
  assert.ok(migrated, `migration lost legacy item ${legacyItem.id}`);
  const { schemaVersion, revision, ...payload } = migrated;
  assert.deepEqual(payload, legacyItem, `migration changed historical item ${legacyItem.id}`);
}
if (orphanIds.length) console.log(`Validated ${orphanIds.length} unindexed archived/staged news item(s): ${orphanIds.join(', ')}`);
console.log('Canonical split records, legacy compatibility data, and deploy-time fallback snapshots are valid.');
