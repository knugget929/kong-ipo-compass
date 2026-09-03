import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const event = JSON.parse(await readFile(process.argv[2], 'utf8'));
const projectState = JSON.parse(await readFile('.project/PROJECT_STATE.json', 'utf8'));
const pr = event.pull_request;
assert.ok(pr, 'pull_request event data is required');
const body = pr.body ?? '';
const fields = new Map();
for (const line of body.split(/\r?\n/)) {
  const match = line.match(/^- ([^:]+):[ \t]*(.*)$/);
  if (match) fields.set(match[1].trim().toLowerCase(), match[2].replace(/`/g, '').trim());
}
const field = (name) => fields.get(name.toLowerCase()) ?? '';
const present = (value) => Boolean(value && !['PENDING', 'N/A', 'NONE'].includes(value.toUpperCase()));
const gate = field('Review gate')?.toUpperCase();
assert.ok(['G0', 'G1', 'G2', 'G3'].includes(gate), 'PR body must declare Review gate: G0, G1, G2, or G3');

if (gate !== 'G0') {
  const builder = field('Builder agent');
  const reviewer = field('Reviewer agent');
  assert.ok(present(builder), gate + ' requires a builder agent');
  assert.ok(present(reviewer), gate + ' requires a reviewer agent');
  assert.notEqual(reviewer, builder, 'reviewer agent must differ from builder agent');
  assert.equal(field('Verdict')?.toUpperCase(), 'VERIFIED', gate + ' requires verdict VERIFIED');
  assert.equal(field('Reviewed head'), pr.head.sha, 'review evidence must match the current PR head');
  assert.ok(present(field('Evidence source')), gate + ' requires an evidence source');
}

const preview = field('Preview URL');
const previewCommit = field('Preview commit');
const exemption = field('Preview exemption');
const candidateUrl = projectState.candidate?.url ?? projectState.candidate_url ?? '';
const normalizedPreview = preview.replace(/\/$/, '');
const normalizedCandidate = candidateUrl.replace(/\/$/, '');
const pointsAtCandidate = Boolean(normalizedCandidate && (normalizedPreview === normalizedCandidate || normalizedPreview.startsWith(normalizedCandidate + '/')));
const hasExactPreview = Boolean(preview && /^https:\/\//.test(preview) && previewCommit === pr.head.sha && !pointsAtCandidate);
const hasExemption = present(exemption);
if (gate === 'G1') assert.ok(hasExactPreview || hasExemption, 'G1 requires a preview or non-product exemption');
if (gate === 'G2') {
  assert.ok(hasExactPreview, 'G2 requires an exact current-head preview');
  assert.equal(field('Candidate action')?.toUpperCase(), 'PROMOTE_AFTER_MERGE');
}
if (gate === 'G3') assert.ok(hasExactPreview || hasExemption, 'G3 requires an exact preview or specific non-product exemption');
if (gate === 'G3') {
  assert.equal(field('Direction decision')?.toUpperCase(), 'APPROVED');
  assert.ok(present(field('Decision record')), 'G3 requires a concrete decision record');
}
console.log('PR ' + gate + ' review evidence is current and complete.');