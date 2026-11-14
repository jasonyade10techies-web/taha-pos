import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

export function assertReleaseContext(context) {
  assert.equal(context.eventName, 'workflow_dispatch', 'Only a manual release dispatch may publish.');
  assert.equal(context.repository, 'jasonyade10techies-web/taha-pos', 'Wrong source repository.');
  assert.equal(context.private, true, 'The source/release repository must be private.');
  assert.ok(['refs/heads/main', 'refs/heads/staging'].includes(context.ref), 'Select main or staging.');
}
export function parseReleaseProperties(text) {
  const values = new Map();
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const pair = /^([A-Za-z]+)=(.+)$/.exec(line.trim());
    assert.ok(pair && !values.has(pair[1]), 'Malformed or duplicate version property.');
    values.set(pair[1], pair[2]);
  }
  const code = values.get('versionCode'), name = values.get('versionName');
  assert.match(code ?? '', /^[1-9][0-9]*$/);
  assert.ok(Number.isSafeInteger(Number(code)), 'Version code must be a safe integer.');
  assert.match(name ?? '', /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/);
  return {versionCode:Number(code), versionName:name};
}
export function assertIncreasingVersion(versionCode, releases) {
  const previous = releases.map(release => /^android-test-v([1-9][0-9]*)$/.exec(release.tag_name)?.[1]).filter(Boolean).map(Number);
  assert.ok(versionCode > Math.max(11, ...previous), 'Increment the committed versionCode beyond all prior test releases, including drafts (baseline 11).');
}
export function assertAssetBytes(bytes, expected) {
  assert.equal(bytes.length, expected.size, 'Release asset byte count mismatch.');
  assert.equal(createHash('sha256').update(bytes).digest('hex'), expected.sha256, 'Release asset checksum mismatch.');
}
export function assertSigningEnvironment(environment,branches,branchName){
  assert.ok(environment.protection_rules?.some(rule=>rule.type==='required_reviewers'&&rule.reviewers?.length>0),'Reviewed signing environment required.');
  assert.equal(environment.deployment_branch_policy?.custom_branch_policies,true,'Signing environment must restrict named branches.');
  assert.ok(branches.branch_policies?.some(branch=>branch.name===branchName&&branch.type==='branch'),'This branch is not approved for signing.');
}
