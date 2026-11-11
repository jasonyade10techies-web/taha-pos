import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ForbiddenException} from '@nestjs/common';


test('direct upload never broadens a camera companion session into general media access',async()=>{
 // A companion must be rejected before storage or database access, even when
 // the service is invoked internally rather than through the HTTP route guard.
 await import('../src/main');const {MediaService}=await import('../src/media/media.service');
 const service=new MediaService(undefined as any,undefined as any,undefined as any,undefined as any,{} as any,undefined as any);
 const actor={userId:'10000000-0000-4000-8000-000000000001',sessionId:'10000000-0000-4000-8000-000000000002',companion:{storeId:'10000000-0000-4000-8000-000000000003',deviceId:'device',terminalId:'terminal'}};
 await assert.rejects(async()=>{await (service as any).createGrant(actor,actor.companion.storeId,{kind:'profile'});},ForbiddenException);
 await assert.rejects(async()=>{await (service as any).completeGrant(actor,actor.companion.storeId,'10000000-0000-4000-8000-000000000004');},ForbiddenException);
 await assert.rejects(async()=>{await (service as any).cancelGrant(actor,actor.companion.storeId,'10000000-0000-4000-8000-000000000004');},ForbiddenException);
});

