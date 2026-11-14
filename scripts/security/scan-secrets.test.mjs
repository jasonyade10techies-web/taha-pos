import test from 'node:test';
import assert from 'node:assert/strict';
import {safeSourcePath} from './scan-secrets.mjs';

test('scanner exports only contained git-listed source paths', () => {
  assert.equal(safeSourcePath('src/main.ts'), 'src/main.ts');
  assert.equal(safeSourcePath('distribution/handler.mjs'), 'distribution/handler.mjs');
  for(const name of ['../.env','/root/key','C:/private/key','src/../.env','.tools/private.txt','.test-postgres/log.txt','server/data/image.png','node_modules/module.js','artifacts/package.zip']) assert.throws(() => safeSourcePath(name));
});
