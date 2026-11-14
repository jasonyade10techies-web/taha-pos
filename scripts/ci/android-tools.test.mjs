import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {findSdkManager,installedAndroidTools} from './android-tools.mjs';
function fixture(work){const root=mkdtempSync(path.join(tmpdir(),'taha-sdk-'));try{const add=name=>{const file=path.join(root,name);mkdirSync(path.dirname(file),{recursive:true});writeFileSync(file,'fixture');return file;};work(root,add);}finally{assert.equal(path.dirname(path.resolve(root)),path.resolve(tmpdir()));rmSync(root,{recursive:true,force:true});}}
test('SDK manager can be in versioned command-line tools rather than PATH or latest',()=>fixture((root,add)=>{assert.throws(()=>findSdkManager(root,'linux'));const expected=add('cmdline-tools/12.0/bin/sdkmanager');assert.equal(findSdkManager(root,'linux'),expected);const latest=add('cmdline-tools/latest/bin/sdkmanager');assert.equal(findSdkManager(root,'linux'),latest);}));
test('cached SDK is accepted only when the actual required platform and signing/build files exist',()=>fixture((root,add)=>{assert.equal(installedAndroidTools(root,'linux'),false);add('platforms/android-35/android.jar');add('build-tools/35.0.0/aapt');assert.equal(installedAndroidTools(root,'linux'),false);add('build-tools/35.0.0/lib/apksigner.jar');assert.equal(installedAndroidTools(root,'linux'),true);}));
