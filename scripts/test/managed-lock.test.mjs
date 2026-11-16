import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {verifyLock}=createRequire(import.meta.url)('../managed-release/verify-lock.cjs');
const pkg={name:'taha-fixture',version:'1.0.0',dependencies:{library:'^1.0.0'}};
const frozen={name:pkg.name,version:pkg.version,lockfileVersion:3,packages:{'':{name:pkg.name,version:pkg.version,dependencies:pkg.dependencies,private:true,scripts:{build:'node verify-release.cjs'}},'node_modules/library':{version:'1.2.3',resolved:'https://registry.npmjs.org/library/-/library-1.2.3.tgz',integrity:'sha512-approved'},'node_modules/optional-platform':{version:'2.0.0',resolved:'https://registry.npmjs.org/optional-platform/-/optional-platform-2.0.0.tgz',integrity:'sha512-platform',optional:true},'node_modules/dev-tool':{version:'1.0.0',dev:true}}};
test('installer may reformat metadata and prune dev/platform entries while keeping approved runtime pins',()=>{
 const actual=structuredClone(frozen);delete actual.packages[''].private;delete actual.packages[''].scripts;delete actual.packages['node_modules/dev-tool'];delete actual.packages['node_modules/optional-platform'];actual.packages['node_modules/library'].license='MIT';
 assert.equal(verifyLock(actual,frozen,pkg),true);
});
test('changed runtime version, integrity, source, missing required package and unapproved package are rejected',()=>{
 for(const key of ['version','resolved','integrity','link']){const actual=structuredClone(frozen);actual.packages['node_modules/library'][key]='changed';assert.throws(()=>verifyLock(actual,frozen,pkg));}
 const missing=structuredClone(frozen);delete missing.packages['node_modules/library'];assert.throws(()=>verifyLock(missing,frozen,pkg));
 const extra=structuredClone(frozen);extra.packages['node_modules/unapproved']={version:'1.0.0'};assert.throws(()=>verifyLock(extra,frozen,pkg));
 const changed=structuredClone(frozen);changed.packages[''].dependencies={library:'^9.0.0'};assert.throws(()=>verifyLock(changed,frozen,pkg));
});
