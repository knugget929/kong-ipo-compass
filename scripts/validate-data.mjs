import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const thesis = await readJson('data/thesis.json');
const news = await readJson('data/news.json');
const thesisSnapshot = await readJson('dist/data/thesis.json');
const newsSnapshot = await readJson('dist/data/news.json');

assert.equal(thesis.schemaVersion, 1);
assert.equal(news.schemaVersion, 1);
assert.ok(Number.isInteger(thesis.revision) && thesis.revision > 0);
assert.ok(Number.isInteger(news.revision) && news.revision > 0);
assert.ok(thesis.verdict && thesis.model?.defaults && thesis.model?.presets);
assert.ok(Array.isArray(thesis.sources) && Array.isArray(thesis.changeLog));
assert.ok(Array.isArray(news.items));
assert.ok(['UPGRADE', 'MAINTAIN', 'DOWNGRADE'].includes(news.thesisDecision));
assert.match(news.lastCheckedAt, /^\d{4}-\d{2}-\d{2}T/);
assert.equal(thesis.model.defaults.ownedShares, 0, 'public defaults must not expose personal holdings');
assert.equal(thesis.model.defaults.costBasis, 0, 'public defaults must not expose personal cost basis');
for (const field of ['arr', 'multiple', 'netCash', 'dilutedShares', 'ipoDiscount']) {
  assert.ok(Number.isFinite(thesis.model.defaults[field]), `default ${field} must be finite`);
  for (const preset of ['bear', 'base', 'bull']) assert.ok(Number.isFinite(thesis.model.presets[preset][field]), `${preset} ${field} must be finite`);
}
for (const source of thesis.sources) assert.equal(new URL(source.url).protocol, 'https:');

for (const item of news.items) {
  assert.ok(item.id && item.publishedAt && item.title && item.summary);
  assert.ok(['UPGRADE', 'MAINTAIN', 'DOWNGRADE'].includes(item.thesisDecision));
  assert.ok(['positive', 'neutral', 'negative'].includes(item.impact));
  assert.ok(Number.isFinite(item.scoreDelta));
  assert.ok(Array.isArray(item.confirmed) && Array.isArray(item.uncertain));
  assert.ok(Array.isArray(item.sources) && item.sources.length > 0);
  for (const source of item.sources) assert.equal(new URL(source.url).protocol, 'https:');
}

assert.deepEqual(thesisSnapshot, thesis, 'deployed thesis snapshot must match canonical data at release');
assert.deepEqual(newsSnapshot, news, 'deployed news snapshot must match canonical data at release');
console.log('Canonical thesis and news data are valid.');