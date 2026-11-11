import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ESLint } from 'eslint';

test('generated audit builds are excluded while application source is linted', async () => {
  const eslint = new ESLint();
  assert.equal(await eslint.isPathIgnored('dist-audit-20261014/assets/index.js'), true);
  assert.equal(await eslint.isPathIgnored('dist-mobile-audit-20261014/assets/index.js'), true);
  assert.equal(await eslint.isPathIgnored('src/stores/ui-store.ts'), false);
});
