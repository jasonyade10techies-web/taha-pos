import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateWindowsRelease,tauriUpdateManifest,verifyTauriSignature} from '../../distribution/windows-manifest.mjs';

// Public, non-secret protocol vector from tauri-apps/plugins-workspace updater tests.
const key=Buffer.from('untrusted comment: minisign public key: A49EF4746FA6E6D7\nRWTX5qZvdPSepDGWg2bz8n6ArQnBMwgQK1geVosorcbLzcunD+KJ+cYe').toString('base64');
const signed='untrusted comment: signature from tauri secret key\nRUTX5qZvdPSepPF2zsjvP/L/TQtBLRnWRvaq+4omK1UEugtQp/USrGiI1v762sDy3id3aor7bRC9ETyeot6lMHHrWoZ5hjUM1Qc=\ntrusted comment: timestamp:1791649051\tfile:payload\tversion:2.0.0\nDDq2CLOEl5cQmC2eJRHlnZPVViOZsu1CjpPKQoei4A/XBfkDqGO0B+QMrcrHgEQ5qV3mne75tdFWhJpqUXh9AA==';
const signature=Buffer.from(signed).toString('base64');
const release={schemaVersion:1,platform:'windows-x86_64',channel:'staging',applicationId:'com.tahamobiles.pos.staging',version:'2.0.0',releasedAt:'2026-11-14T12:00:00Z',releaseNotes:['Bundled counter application'],files:[{type:'nsis',url:'/downloads/taha-pos/windows/staging/2.0.0/Taha-POS-setup.exe',sizeBytes:4,sha256:'9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',signature}],sourceCommit:'a'.repeat(40)};

test('Tauri verification accepts an upstream signed-version vector and rejects changed bytes, metadata and key',()=>{
 assert.equal(verifyTauriSignature(Buffer.from('test'),signature,key,'2.0.0'),true);
 for(const [bytes,sig,pub,version]of [[Buffer.from('changed'),signature,key,'2.0.0'],[Buffer.from('test'),signature,key,'9.9.9'],[Buffer.from('test'),Buffer.from(signed.replace('version:2.0.0','version:9.9.9')).toString('base64'),key,'9.9.9'],[Buffer.from('test'),signature,Buffer.from('invalid').toString('base64'),'2.0.0']])assert.throws(()=>verifyTauriSignature(bytes,sig,pub,version));
});
test('Windows manifest binds the platform, channel, version, file identity and bounded bytes',()=>{
 assert.deepEqual(validateWindowsRelease(release),release);
 for(const value of [{...release,channel:'stable'},{...release,version:'3.0.0'},{...release,files:[{...release.files[0],url:'https://other.test/setup.exe'}]},{...release,files:[{...release.files[0],url:'/downloads/taha-pos/windows/staging/2.0.0/../secret.exe'}]},{...release,files:[{...release.files[0],sizeBytes:513*1024*1024}]},{...release,files:[{...release.files[0],sha256:'invalid'}]}])assert.throws(()=>validateWindowsRelease(value));
});
test('Tauri endpoint uses only the explicit public HTTPS origin and signed artifact path',()=>{
 const actual=tauriUpdateManifest(release,'https://shop.example.test');
 assert.equal(actual.version,'2.0.0');assert.equal(actual.platforms['windows-x86_64'].url,'https://shop.example.test/downloads/taha-pos/windows/staging/2.0.0/Taha-POS-setup.exe');assert.equal(actual.platforms['windows-x86_64'].signature,signature);
 for(const origin of ['http://shop.test','https://shop.test/private','https://user:secret@shop.test','https://shop.test/?token=bad'])assert.throws(()=>tauriUpdateManifest(release,origin));
});
