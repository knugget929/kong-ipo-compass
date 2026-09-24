import assert from 'node:assert/strict';
import test from 'node:test';
import {
  validateNewsDataset,
  validateScheduledWriteTransition,
  validateThesisRecord
} from './news-data.mjs';

const source = { label: 'Example source', url: 'https://example.com/source' };
const makeItem = (id = '2026-09-20-example', publishedAt = '2026-09-20', overrides = {}) => ({
  schemaVersion: 1, revision: 1, id, publishedAt, title: 'Example material development',
  impact: 'positive', significance: 'meaningful', thesisDecision: 'MAINTAIN', scoreDelta: 0,
  summary: 'A concise material-news summary.', confirmed: ['Confirmed fact.'], uncertain: ['Remaining uncertainty.'],
  sources: [source], ...overrides
});
const meta = (item) => Object.fromEntries(['id', 'publishedAt', 'title', 'impact', 'significance', 'thesisDecision', 'scoreDelta'].map((key) => [key, item[key]]));
const makeNews = () => {
  const item = makeItem();
  return {
    index: { schemaVersion: 1, revision: 1, historyLimit: 30, items: [meta(item)] },
    check: { schemaVersion: 1, revision: 1, lastCheckedAt: '2026-09-20T04:00:00+03:00', status: 'NO_MATERIAL_CHANGE', thesisDecision: 'MAINTAIN', summary: 'No material thesis change.' },
    itemsById: new Map([[item.id, item]])
  };
};
const makeThesis = () => ({
  schemaVersion: 1,
  revision: 1,
  updatedAt: '2026-09-20T04:00:00+03:00',
  asOf: '2026-09-20',
  verdict: { score: 10 },
  model: {
    defaults: { arr: 100, multiple: 10, netCash: 0, dilutedShares: 100, ipoDiscount: 10, ownedShares: 0, costBasis: 0 },
    presets: {
      bear: { arr: 80, multiple: 8, netCash: 0, dilutedShares: 100, ipoDiscount: 15 },
      base: { arr: 100, multiple: 10, netCash: 0, dilutedShares: 100, ipoDiscount: 10 },
      bull: { arr: 120, multiple: 12, netCash: 0, dilutedShares: 100, ipoDiscount: 5 }
    }
  },
  scorecard: [{ label: 'Example', score: 10 }],
  sources: [{ label: 'Baseline source', url: 'https://example.com/baseline' }],
  changeLog: [{ date: '2026-09-20', verdict: 'MAINTAIN', headline: 'Baseline', detail: 'Initial baseline.' }]
});
const cloneNews = (news) => ({
  index: structuredClone(news.index),
  check: structuredClone(news.check),
  itemsById: new Map([...news.itemsById.entries()].map(([id, item]) => [id, structuredClone(item)]))
});
const makeState = () => ({ news: makeNews(), thesis: makeThesis() });
const cloneState = (state) => ({ news: cloneNews(state.news), thesis: structuredClone(state.thesis) });
const makeMaterialCandidate = (before, { thesisChange = false, itemOverrides = {} } = {}) => {
  const after = cloneState(before);
  const fresh = makeItem('2026-09-21-new-material', '2026-09-21', {
    sources: [{ label: 'New evidence', url: 'https://example.com/new-evidence' }],
    ...itemOverrides
  });
  after.news.itemsById.set(fresh.id, fresh);
  after.news.index = { ...after.news.index, revision: 2, items: [meta(fresh), ...after.news.index.items] };
  after.news.check = {
    ...after.news.check,
    revision: 2,
    lastCheckedAt: '2026-09-21T05:00:00+03:00',
    status: 'MATERIAL_CHANGE',
    thesisDecision: fresh.thesisDecision,
    summary: 'New material evidence added.'
  };
  const changedPaths = [
    `data/news/items/${fresh.id}.json`,
    'data/news/index.json',
    'data/checks/latest.json'
  ];
  if (thesisChange) {
    after.thesis.revision = 2;
    after.thesis.updatedAt = '2026-09-21T05:00:00+03:00';
    after.thesis.asOf = '2026-09-21';
    after.thesis.sources = [...after.thesis.sources, { label: 'New evidence', url: 'https://example.com/new-evidence' }];
    after.thesis.changeLog = [{ date: '2026-09-21', verdict: fresh.thesisDecision, headline: 'New evidence recorded', detail: 'The newly recorded public evidence changes the canonical thesis record.' }, ...after.thesis.changeLog];
    changedPaths.push('data/thesis.json');
  }
  return { after, changedPaths, fresh };
};

test('full validators accept valid baseline records', () => {
  const state = makeState();
  assert.doesNotThrow(() => validateNewsDataset(state.news));
  assert.doesNotThrow(() => validateThesisRecord(state.thesis));
});

test('valid no-news scheduled update', () => {
  const before = makeState();
  const after = cloneState(before);
  after.news.check = { ...after.news.check, revision: 2, lastCheckedAt: '2026-09-21T05:00:00+03:00', summary: 'Fresh check; still no material change.' };
  assert.deepEqual(validateScheduledWriteTransition({ before, after, changedPaths: ['data/checks/latest.json'] }), { pattern: 'NO_MATERIAL_NEWS' });
});

test('invalid scheduled revision is rejected', () => {
  const before = makeState();
  const after = cloneState(before);
  after.news.check = { ...after.news.check, revision: 3, lastCheckedAt: '2026-09-21T05:00:00+03:00' };
  assert.throws(() => validateScheduledWriteTransition({ before, after, changedPaths: ['data/checks/latest.json'] }), /increment by exactly 1/);
});

test('malformed timestamp is rejected', () => {
  const before = makeState();
  const after = cloneState(before);
  after.news.check = { ...after.news.check, revision: 2, lastCheckedAt: 'yesterday' };
  assert.throws(() => validateScheduledWriteTransition({ before, after, changedPaths: ['data/checks/latest.json'] }), /check time/);
});

test('invalid thesis decision is rejected', () => {
  const before = makeState();
  const after = cloneState(before);
  after.news.check = { ...after.news.check, revision: 2, lastCheckedAt: '2026-09-21T05:00:00+03:00', thesisDecision: 'HOLD' };
  assert.throws(() => validateScheduledWriteTransition({ before, after, changedPaths: ['data/checks/latest.json'] }), /decision is invalid/);
});

test('valid new material item scheduled update', () => {
  const before = makeState();
  const { after, changedPaths, fresh } = makeMaterialCandidate(before);
  assert.deepEqual(validateScheduledWriteTransition({ before, after, changedPaths }), { pattern: 'MATERIAL_NEWS_THESIS_UNCHANGED', newItemId: fresh.id });
});

test('duplicate IDs are rejected', () => {
  const data = makeNews();
  data.index.items.push({ ...data.index.items[0] });
  assert.throws(() => validateNewsDataset(data), /duplicate id/);
});

test('missing indexed item is rejected', () => {
  const data = makeNews();
  data.itemsById.clear();
  assert.throws(() => validateNewsDataset(data), /missing item/);
});

test('filename and item ID mismatch is rejected', () => {
  const data = makeNews();
  const item = data.itemsById.values().next().value;
  data.itemsById = new Map([['2026-09-20-wrong-filename', item]]);
  data.index.items = [meta(item)];
  assert.throws(() => validateNewsDataset(data), /filename\/id mismatch/);
});

test('non-HTTPS source is rejected', () => {
  const data = makeNews();
  data.itemsById.get('2026-09-20-example').sources = [{ label: 'bad', url: 'http://example.com' }];
  assert.throws(() => validateNewsDataset(data), /HTTPS/);
});

test('invalid significance is rejected', () => {
  const data = makeNews();
  data.itemsById.get('2026-09-20-example').significance = 'viral';
  assert.throws(() => validateNewsDataset(data), /significance/);
});

test('history-limit violation is rejected', () => {
  const data = makeNews();
  data.index.historyLimit = 2;
  const second = makeItem('2026-09-19-second', '2026-09-19');
  const third = makeItem('2026-09-18-third', '2026-09-18');
  data.index.items = [meta(data.itemsById.values().next().value), meta(second), meta(third)];
  data.itemsById.set(second.id, second);
  data.itemsById.set(third.id, third);
  assert.throws(() => validateNewsDataset(data), /exceeds history limit/);
});

test('safe orphan item remains valid and unindexed', () => {
  const data = makeNews();
  const orphan = makeItem('2026-09-19-orphan', '2026-09-19');
  data.itemsById.set(orphan.id, orphan);
  assert.deepEqual(validateNewsDataset(data).orphanIds, [orphan.id]);
});

test('material-news transition keeps thesis unchanged when thesis path is absent', () => {
  const before = makeState();
  const { after, changedPaths } = makeMaterialCandidate(before);
  assert.doesNotThrow(() => validateScheduledWriteTransition({ before, after, changedPaths }));
  assert.deepEqual(after.thesis, before.thesis);
});

test('valid evidence-backed thesis change is accepted', () => {
  const before = makeState();
  const { after, changedPaths, fresh } = makeMaterialCandidate(before, { thesisChange: true });
  assert.deepEqual(validateScheduledWriteTransition({ before, after, changedPaths }), { pattern: 'MATERIAL_NEWS_THESIS_CHANGED', newItemId: fresh.id });
});

test('prohibited/private fields are rejected', () => {
  const before = makeState();
  const after = cloneState(before);
  after.news.check = { ...after.news.check, revision: 2, lastCheckedAt: '2026-09-21T05:00:00+03:00', execution: { apiKey: 'should-never-be-stored' } };
  assert.throws(() => validateScheduledWriteTransition({ before, after, changedPaths: ['data/checks/latest.json'] }), /prohibited\/private field/);
});

test('thesis personal-input exception is limited to existing model paths', () => {
  const thesis = makeThesis();
  thesis.model.ranges = { ownedShares: [0, 100000, 500], costBasis: [0, 30, 0.25] };
  assert.doesNotThrow(() => validateThesisRecord(thesis));
  for (const extra of [
    { ownedShares: 12345 },
    { personal: { ownedShares: 12345, costBasis: 54321 } },
    { notes: [{ costBasis: 54321 }] }
  ]) assert.throws(() => validateThesisRecord({ ...thesis, ...extra }), /prohibited\/private field/);
  const alias = structuredClone(thesis);
  alias.model.defaults.owned_shares = 12345;
  assert.throws(() => validateThesisRecord(alias), /prohibited\/private field/);
  const nonzero = structuredClone(thesis);
  nonzero.model.defaults.ownedShares = 12345;
  assert.throws(() => validateThesisRecord(nonzero), /must not expose personal holdings/);
});

test('material-news transition preserves all retained historical index metadata', () => {
  for (const change of [{ title: 'Rewritten historical title' }, { extra: 'Unexpected metadata' }]) {
    const before = makeState();
    const { after, changedPaths } = makeMaterialCandidate(before);
    Object.assign(after.news.index.items[1], change);
    assert.throws(() => validateScheduledWriteTransition({ before, after, changedPaths }), /index metadata does not match|retained historical index entries/);
  }
});
