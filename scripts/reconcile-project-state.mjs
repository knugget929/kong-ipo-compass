import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const token = process.env.GITHUB_TOKEN;
if (!token) {
  console.log('GITHUB_TOKEN unavailable; skipped remote truth reconciliation.');
  process.exit(0);
}

const state = JSON.parse(await readFile('.project/PROJECT_STATE.json', 'utf8'));
const repository = process.env.GITHUB_REPOSITORY ?? state.project;
assert.ok(repository && repository.includes('/'), 'repository must be owner/name');
const headers = {
  Accept: 'application/vnd.github+json',
  Authorization: 'Bearer ' + token,
  'X-GitHub-Api-Version': '2022-11-28',
};

async function github(path) {
  const response = await fetch('https://api.github.com/repos/' + repository + path, { headers });
  assert.ok(response.ok, path + ' returned ' + response.status);
  return response.json();
}

for (const track of state.active_tracks ?? []) {
  if (!track.pr) continue;
  assert.ok(track.branch, track.id + ' requires a branch');
  assert.ok(track.head_sha, track.id + ' requires a recorded reconciliation head');
  const pr = await github('/pulls/' + track.pr);
  assert.equal(pr.state, 'open', track.id + ' PR is not open');
  assert.equal(pr.head.ref, track.branch, track.id + ' branch does not match PR');
  const comparison = await github('/compare/' + track.head_sha + '...' + pr.head.sha);
  assert.ok(
    ['ahead', 'identical'].includes(comparison.status),
    track.id + ' recorded head must remain an ancestor of the live PR head',
  );
}

console.log('Active PR branches and same-history head ancestry match project state.');