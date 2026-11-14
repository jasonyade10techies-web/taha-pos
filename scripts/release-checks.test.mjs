import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isolatedPostgres,isolatedIdentity} from './release-checks.mjs';
test('release checks accept only the disposable local cluster',()=>assert.equal(isolatedPostgres('postgresql://taha_phase5c@127.0.0.1:55459/postgres'),'postgresql://taha_phase5c@127.0.0.1:55459/postgres'));
test('saved shop PostgreSQL and remote databases are refused before tests',()=>{for(const value of ['postgresql://taha_phase5c@127.0.0.1:55439/postgres','postgresql://taha_phase5c@cloud.example:55459/postgres','postgresql://taha_phase5c@127.0.0.1:55459/shop'])assert.throws(()=>isolatedPostgres(value));});
test('extra connection options and arbitrary roles cannot bypass isolation',()=>{for(const value of ['postgresql://owner@127.0.0.1:55459/postgres','postgresql://taha_phase5c@127.0.0.1:55459/postgres?host=cloud.example','postgresql://taha_phase5c@127.0.0.1:55459/postgres#shop'])assert.throws(()=>isolatedPostgres(value));});
test('actual cluster directory and role must both match the isolated fixture',()=>{isolatedIdentity('D:/Inventory system POS/.test-postgres/phase5c-20261014/pgdata','taha_phase5c');assert.throws(()=>isolatedIdentity('D:/shop/pgdata','taha_phase5c'));assert.throws(()=>isolatedIdentity('D:/Inventory system POS/.test-postgres/phase5c-20261014/pgdata','owner'));});
