import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const queue = await readFile('.project/WORK_QUEUE.yaml', 'utf8');
const state = JSON.parse(await readFile('.project/PROJECT_STATE.json', 'utf8'));
const policy = await readFile('.project/REVIEW_POLICY.yaml', 'utf8');
assert.match(queue, /^schema_version: 2$/m);
assert.match(policy, /^schema_version: 2$/m);
assert.equal(state.schema_version, 2);

const retention = state.site_retention;
assert.ok(retention, 'PROJECT_STATE must define site_retention');
assert.deepEqual(retention.permanent_sites, ['production']);
assert.ok(Number.isInteger(retention.max_active_exact_pr_previews));
assert.ok(retention.max_active_exact_pr_previews >= 0 && retention.max_active_exact_pr_previews <= 3);
assert.ok(Array.isArray(retention.active_exact_pr_previews));
assert.ok(retention.active_exact_pr_previews.length <= retention.max_active_exact_pr_previews, 'active exact PR previews exceed the retention limit');
assert.ok(Array.isArray(retention.pending_deletions), 'pending_deletions must be an exact project inventory');
assert.ok(['RECONCILED', 'DELETE_PENDING_CAPABILITY_UNAVAILABLE'].includes(retention.cleanup_status));
const pendingProjectIds = retention.pending_deletions.map((item) => item.project_id);
assert.equal(new Set(pendingProjectIds).size, pendingProjectIds.length, 'pending deletion project IDs must be unique');
for (const item of retention.pending_deletions) {
  assert.ok(item.project_id && item.slug, 'each pending deletion requires an exact project_id and slug');
}
if (retention.cleanup_status === 'RECONCILED') assert.equal(retention.pending_deletions.length, 0, 'reconciled retention cannot have pending deletions');
if (retention.cleanup_status === 'DELETE_PENDING_CAPABILITY_UNAVAILABLE') assert.ok(retention.pending_deletions.length > 0, 'unavailable deletion status requires an exact pending inventory');

const blocks = [...queue.matchAll(/^  - id: (.+)\n([\s\S]*?)(?=^  - id: |$(?![\s\S]))/gm)].map((match) => ({ id: match[1].trim(), source: match[2] }));
assert.ok(blocks.length > 0, 'queue must define tasks');
const ids = new Set(blocks.map((task) => task.id));
assert.equal(ids.size, blocks.length, 'task IDs must be unique');
for (const task of blocks) {
  for (const field of ['work_type', 'priority', 'risk', 'review_gate', 'status', 'depends_on', 'owns', 'definition_of_done']) {
    assert.match(task.source, new RegExp('^    ' + field + ':', 'm'), task.id + ' missing ' + field);
  }
  assert.match(task.source, /^    priority: P[0-4]$/m);
  assert.match(task.source, /^    review_gate: G[0-3]$/m);
  const dependencies = task.source.match(/^    depends_on: \[(.*)\]$/m)?.[1].split(',').map((value) => value.trim()).filter(Boolean) ?? [];
  for (const dependency of dependencies) assert.ok(ids.has(dependency), task.id + ' has unknown dependency ' + dependency);
}
for (const track of state.active_tracks) assert.ok(ids.has(track.id), 'active track missing from queue: ' + track.id);
for (const field of ['next_eligible_tasks', 'blocked_tasks']) {
  for (const item of state[field] ?? []) {
    const id = typeof item === 'string' ? item : item.id;
    assert.ok(ids.has(id), field + ' references unknown task: ' + id);
  }
}
console.log('Project workflow state is valid.');