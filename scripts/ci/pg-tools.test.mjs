import test from 'node:test';
import assert from 'node:assert/strict';
import {resolvePostgresTool} from './pg-tools.mjs';

test('PostgreSQL tools honor an explicit bin path and platform extension', () => {
  assert.equal(resolvePostgresTool('pg_dump', {platform:'win32',bin:'C:/test/pgsql/bin'}), 'C:\\test\\pgsql\\bin\\pg_dump.exe');
  assert.equal(resolvePostgresTool('pg_restore', {platform:'linux',bin:'/usr/lib/postgresql/17/bin'}), '/usr/lib/postgresql/17/bin/pg_restore');
});
test('Linux can use PATH while Windows retains the existing local toolchain default', () => {
  assert.equal(resolvePostgresTool('pg_dump', {platform:'linux',bin:''}), 'pg_dump');
  assert.match(resolvePostgresTool('pg_dump', {platform:'win32',bin:''}), /\.test-postgres\\pgsql\\bin\\pg_dump\.exe$/);
  assert.throws(() => resolvePostgresTool('../psql'));
});
