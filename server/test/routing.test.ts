import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveOperation } from '../src/business/operations';
test('operation mapping is allowlisted and cannot accept SQL/function names from callers',()=> {
 assert.equal(resolveOperation('products.pos').function,'get_pos_products');
 assert.throws(()=>resolveOperation('pg_read_file'));
 assert.throws(()=>resolveOperation('complete_sale; drop table profiles'));
});
