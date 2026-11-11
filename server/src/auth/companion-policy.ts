import {ForbiddenException} from '@nestjs/common';
import type {Request} from 'express';
import type {Actor} from '../database/database.service';
export function requireProtectedChannel(req:Request){
 // Forwarded headers are deliberately insufficient: the configured LAN listener
 // terminates TLS itself and the Android client pins its SPKI from the QR.
 if(!(req.socket as {encrypted?:boolean}).encrypted)throw new ForbiddenException('Connect through the protected shop HTTPS address. Cleartext enrollment is disabled.');
}
export function companionRoute(actor:Actor,req:Request){
 const c=actor.companion;if(!c)return;
 requireProtectedChannel(req);
 const route=req.path.replace(/^\/api\/v1/,'');
 if((route==='/auth/session'&&req.method==='GET')||(route==='/auth/logout'&&req.method==='POST'))return;
 const base=`/stores/${c.storeId}/camera/`;
 if(!route.startsWith(base))throw new ForbiddenException('This companion session permits camera requests only. Use an authorized staff account for sales and management.');
 const path=route.slice(base.length),method=req.method;
 if((path==='devices/register'||path==='devices/heartbeat')&&method==='POST'){
  if(req.body?.deviceId!==c.deviceId||req.body?.terminalId)throw new ForbiddenException('Wrong companion device.');return;
 }
 // Devices is used by the existing bridge to recover this phone's pairing.
 if(path==='devices'&&method==='GET')return;
 if((path==='jobs'||/^jobs\/[a-f0-9-]{36}$/.test(path))&&method==='GET')return;
 if(/^jobs\/[a-f0-9-]{36}$/.test(path)&&method==='PATCH')return;
 if(/^jobs\/[a-f0-9-]{36}\/(captures|confirm|finish)$/.test(path)&&method==='POST')return;
 throw new ForbiddenException('This action is outside this phone’s camera scope.');
}
