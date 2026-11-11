import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hashPassword, verifyPassword, digestToken, createToken, validatePassword } from '../src/auth/crypto';

test('passwords are Argon2id hashes with random salts; wrong password fails', async () => {
  const a=await hashPassword('Correct horse 123!'), b=await hashPassword('Correct horse 123!');
  assert.match(a,/^\$argon2id\$/); assert.notEqual(a,b);
  assert(await verifyPassword(a,'Correct horse 123!')); assert.equal(await verifyPassword(a,'wrong'),false);
});
test('refresh tokens have 256 bits of entropy and only digests are persisted', () => {
  const token=createToken(); assert.equal(token.length,64); assert.notEqual(token,createToken());
  assert.notEqual(digestToken(token),token); assert.equal(digestToken(token),digestToken(token));
});
test('password validation accepts passphrases and rejects weak passwords', () => {
  assert.throws(()=>validatePassword('short')); validatePassword('a long secure passphrase');
});
