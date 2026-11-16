import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
// Exact original bytes already recorded in the approved staging registry.
// These six files previously changed under core.autocrlf during Linux checkout.
const applied=[
 ['202610030107_repair_photo_categories.sql','96320e2fc5ea515df987a787f490e49539b94bc33f8cdceca23218cbba9d3502'],
 ['202610210100_shop_configuration_and_customer_ledger.sql','93a810cc9133e0dfabb26502b2a8cf993b051a990c20321149bed7216f36d0d5'],
 ['202610210110_catalogue_values_and_opening_conditions.sql','901a6fc5947334a456989785557a2082a8e043086c1e71249dec77069af60bb3'],
 ['202610210120_customer_activity_detail.sql','1e5fcaa288b0aeb4a467cc92fc6f60cfc1512f1b19b2553805d763d56640d9e9'],
 ['202610220140_dashboard_record_navigation.sql','029bd867b6e7f19413fc744718828d2baea82076851fc1a8470a6ba402a26820'],
 ['202610290100_cloud_uploads.sql','089d91deab0abda2582eb2008cd59a0c2cfa644feb4d8678c9fcd3e31e091ffc']
];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
test('Git stores the original applied migration bytes so Linux deployment matches the existing cloud registry',()=>{
 for(const [name,expected]of applied){const file='server/migrations/'+name;assert.equal(sha(readFileSync(file)),expected,'Working migration bytes: '+name);assert.equal(sha(execFileSync('git',['show',':'+file])),expected,'Tracked migration bytes would change in a fresh checkout: '+name);}
});
