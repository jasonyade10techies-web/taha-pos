import assert from 'node:assert/strict';
import {test} from 'node:test';
import type {Database} from '../src/database/database.service';
import type {CounterGateway} from '../src/realtime/counter.gateway';
import type {PushService} from '../src/camera/push.service';
import type {Configuration} from '../src/config';
test('camera status exposes assignment independently and expiry overrides stale assignments',async()=>{
 await import('../src/main');
 const {CameraService}=await import('../src/camera/camera.service');
 const camera=new CameraService({} as Database,{} as CounterGateway,{} as PushService,{} as Configuration);
 for(const [status,device_session_id,claim_hash,expires_at,want] of [
  ['waiting',null,'capability','2999-01-01','UNASSIGNED'],
  ['waiting','session','capability','2999-01-01','ASSIGNED'],
  ['waiting','session',null,'2999-01-01','CLAIMED'],
  ['opened','session',null,'2999-01-01','IN_PROGRESS'],
  ['received','session',null,'2000-01-01','COMPLETED'],
  ['cancelled','session',null,'2999-01-01','CANCELLED'],
  ['waiting','session',null,'2000-01-01','EXPIRED'],
 ])assert.equal((await camera.safe({status,device_session_id,claim_hash,expires_at})).assignmentState,want);
});
