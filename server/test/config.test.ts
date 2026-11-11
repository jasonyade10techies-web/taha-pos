import assert from 'node:assert/strict';
import {test} from 'node:test';
import {configuration} from '../src/config';
test('production requires an explicit HTTPS public API origin for private image capabilities',()=>{
 const previous={...process.env};try{
  process.env.NODE_ENV='production';process.env.DATABASE_URL='postgresql://test@localhost/test';process.env.JWT_SECRET='unit-test-only-configuration-secret-32bytes';process.env.FRONTEND_ORIGIN='https://pos.example';delete process.env.PUBLIC_API_URL;
  assert.throws(()=>configuration(),/PUBLIC_API_URL/);
  process.env.PUBLIC_API_URL='http://pos.example';assert.throws(()=>configuration(),/HTTPS/);
  process.env.PUBLIC_API_URL='https://pos.example';assert.equal(configuration().publicUrl,'https://pos.example');assert.ok(configuration().origins.includes('http://tauri.localhost'));
 }finally{for(const key of Object.keys(process.env))if(!(key in previous))delete process.env[key];Object.assign(process.env,previous);}
});
test('bundled Android origin is explicit and cannot become a credentialed wildcard',()=>{
 const previous={...process.env};try{process.env.DATABASE_URL='postgresql://test@localhost/test';process.env.JWT_SECRET='unit-test-only-configuration-secret-32bytes';process.env.NODE_ENV='production';process.env.FRONTEND_ORIGIN='https://pos.example';process.env.PUBLIC_API_URL='https://pos.example';process.env.MOBILE_APP_ORIGIN='http://localhost';assert.ok(configuration().origins.includes('http://localhost'));process.env.MOBILE_APP_ORIGIN='*';assert.throws(()=>configuration(),/fixed bundled Android origin/);}finally{for(const key of Object.keys(process.env))if(!(key in previous))delete process.env[key];Object.assign(process.env,previous);}
});
