import assert from 'node:assert/strict';
import {test} from 'node:test';
import {BadRequestException,ForbiddenException} from '@nestjs/common';
import jwt from 'jsonwebtoken';
import type {Actor,Database} from '../src/database/database.service';
import type {LocalFileStorage} from '../src/media/file-storage';
import type {AuthService} from '../src/auth/auth.service';
import type {CameraService} from '../src/camera/camera.service';
import type {Configuration} from '../src/config';
import type {CounterGateway} from '../src/realtime/counter.gateway';

const store='10000000-0000-4000-8000-000000000001';
const actor:Actor={userId:'10000000-0000-4000-8000-000000000002',sessionId:'10000000-0000-4000-8000-000000000003'};
const secret='isolated-media-recovery-unit-secret-2026';
async function service(auth?:AuthService){
 await import('../src/main');
 const {MediaService}=await import('../src/media/media.service');
 return new MediaService(undefined as unknown as Database,undefined as unknown as LocalFileStorage,auth as AuthService,undefined as unknown as CameraService,{secret} as Configuration,undefined as unknown as CounterGateway);
}

// Removing the actual byte limit must reject here before image decoding or DB use.
test('multipart images reject oversized actual bytes even when advertised size is small',async()=>{
 const media=await service();
 const file={buffer:Buffer.alloc(16*1024*1024+1),size:1,mimetype:'image/png'} as Express.Multer.File;
 await assert.rejects(media.upload(actor,store,file,{kind:'product'}),BadRequestException);
});

// A private companion capability cannot be redeemed over an HTTP socket.
test('companion media capability rejects cleartext before media storage lookup',async()=>{
 const companion:Actor={...actor,companion:{storeId:store,terminalId:'counter',deviceId:'phone'}};
 const auth={authenticate:async()=>companion} as unknown as AuthService;
 const media=await service(auth),id='10000000-0000-4000-8000-000000000004';
 const token=jwt.sign({mid:id,sid:actor.sessionId},secret,{subject:actor.userId,algorithm:'HS256',expiresIn:300,audience:'taha-pos-media',issuer:'taha-pos'});
 await assert.rejects(media.read(id,token,false,false,false),ForbiddenException);
});

test('companion cannot invoke general multipart profile upload internally',async()=>{
 const media=await service(),companion:Actor={...actor,companion:{storeId:store,terminalId:'counter',deviceId:'phone'}};
 const file={buffer:Buffer.from('image'),size:5,mimetype:'image/png'} as Express.Multer.File;
 await assert.rejects(media.upload(companion,store,file,{kind:'profile'}),ForbiddenException);
});
