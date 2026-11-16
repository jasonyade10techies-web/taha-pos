'use strict';
function ordered(value){if(Array.isArray(value))return value.map(ordered);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,ordered(value[key])]));return value;}
function equal(a,b){return JSON.stringify(ordered(a))===JSON.stringify(ordered(b));}
function verifyLock(actual,approved,pkg){
 for(const lock of [actual,approved]){
  if(!lock||![2,3].includes(lock.lockfileVersion)||!lock.packages||Array.isArray(lock.packages)||lock.name!==pkg.name||lock.version!==pkg.version)throw Error('Invalid npm lockfile identity.');
  const root=lock.packages[''];if(!root||root.name!==pkg.name||root.version!==pkg.version)throw Error('Invalid root dependency identity.');
  for(const field of ['dependencies','optionalDependencies','peerDependencies'])if(!equal(root[field]||{},pkg[field]||{}))throw Error('Root dependencies do not match the approved package.');
 }
 for(const [name,entry]of Object.entries(actual.packages)){
  if(!name)continue;
  const expected=approved.packages[name];
  if(!expected||!entry||typeof entry!=='object')throw Error('Unapproved npm package: '+name);
  for(const field of ['version','resolved','integrity','link'])if(entry[field]!==expected[field])throw Error('Runtime dependency pin changed: '+name+' ('+field+').');
  if(!expected.dev&&!expected.optional&&entry.dev)throw Error('Required runtime dependency was marked development-only: '+name);
 }
 for(const [name,entry]of Object.entries(approved.packages))if(name&&!entry.dev&&!entry.optional&&!actual.packages[name])throw Error('Required runtime dependency missing: '+name);
 return true;
}
module.exports={verifyLock};
