import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseReleaseProperties, assertReleaseContext, assertIncreasingVersion, assertAssetBytes,assertSigningEnvironment} from './release-policy.mjs';

const context = {eventName:'workflow_dispatch', repository:'jasonyade10techies-web/taha-pos', ref:'refs/heads/main', private:true};
test('release requires manual dispatch in the intended private source repository', () => {
  assert.doesNotThrow(() => assertReleaseContext(context));
  for (const patch of [{eventName:'pull_request'}, {eventName:'push'}, {repository:'other/taha-pos'}, {ref:'refs/heads/feature'}, {private:false}]) {
    assert.throws(() => assertReleaseContext({...context,...patch}));
  }
});
test('version is an explicit positive committed integer with a safe display name', () => {
  assert.deepEqual(parseReleaseProperties('versionCode=12\nversionName=0.5R.4\n'), {versionCode:12,versionName:'0.5R.4'});
  for(const text of ['versionCode=0\nversionName=x','versionCode=12.1\nversionName=x','versionCode=12\nversionName=x\nversionCode=13','versionCode=12\nversionName=bad name','versionCode=9007199254740992\nversionName=x']) assert.throws(() => parseReleaseProperties(text));
});
test('version must exceed baseline 11 and every previous test-channel release including drafts', () => {
  assert.doesNotThrow(() => assertIncreasingVersion(12, []));
  assert.throws(() => assertIncreasingVersion(11, []));
  assert.throws(() => assertIncreasingVersion(12, [{tag_name:'android-test-v12',draft:true}]));
  assert.throws(() => assertIncreasingVersion(12, [{tag_name:'android-test-v13'}]));
  assert.doesNotThrow(() => assertIncreasingVersion(12, [{tag_name:'unrelated-v999'}]));
});
test('uploaded assets must match complete size and SHA256 before a draft can publish', () => {
  const bytes = Buffer.from('APK fixture bytes');
  const expected = {size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
  assert.doesNotThrow(() => assertAssetBytes(bytes, expected));
  assert.throws(() => assertAssetBytes(bytes.subarray(1), expected));
  assert.throws(() => assertAssetBytes(Buffer.from('APK fixture byteX'), expected));
});
test('CI signing fails closed without enforceable review and a matching branch policy',()=>{
 const environment={protection_rules:[{type:'required_reviewers',reviewers:[{type:'User'}]}],deployment_branch_policy:{custom_branch_policies:true}},branches={branch_policies:[{name:'staging',type:'branch'}]};
 assert.doesNotThrow(()=>assertSigningEnvironment(environment,branches,'staging'));
 for(const changed of [{...environment,protection_rules:[]},{...environment,deployment_branch_policy:null}])assert.throws(()=>assertSigningEnvironment(changed,branches,'staging'));
 assert.throws(()=>assertSigningEnvironment(environment,branches,'feature'));assert.throws(()=>assertSigningEnvironment(environment,{branch_policies:[]},'staging'));
});
