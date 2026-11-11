import {Inject,OnModuleDestroy,OnModuleInit} from '@nestjs/common';
import {ConnectedSocket,MessageBody,OnGatewayConnection,OnGatewayDisconnect,SubscribeMessage,WebSocketGateway,WebSocketServer} from '@nestjs/websockets';
import {Server,Socket} from 'socket.io';
import {AuthService} from '../auth/auth.service';
import {Database,type Actor} from '../database/database.service';
import {CONFIG,type Configuration} from '../config';
import {uuid} from '../business/business.service';
import {assignmentState} from '../camera/camera-state';
@WebSocketGateway({namespace:'/counter',transports:['websocket']})
export class CounterGateway implements OnGatewayConnection,OnGatewayDisconnect,OnModuleInit,OnModuleDestroy {
 @WebSocketServer() server!:Server;
 constructor(@Inject(AuthService) private readonly auth:AuthService,@Inject(Database) private readonly db:Database,@Inject(CONFIG) private readonly config:Configuration){}
 private presence=new Map<string,boolean>();
 private timer?:ReturnType<typeof setInterval>;
 onModuleInit(){this.timer=setInterval(()=>{void this.refreshPresence().catch(()=>{});},15000);this.timer.unref();}
 onModuleDestroy(){if(this.timer)clearInterval(this.timer);}
 async handleConnection(socket:Socket){
  try{if(!socket.handshake.headers.origin||!this.config.origins.includes(socket.handshake.headers.origin))throw new Error('Origin denied.');
   const actor=await this.auth.authenticate(String(socket.handshake.auth.accessToken??''),socket.handshake.auth.counterToken);if(actor.companion)throw new Error('Companion devices use protected HTTPS polling.');socket.data.actor=actor;
   await socket.join('session:'+actor.sessionId);
  }catch{socket.disconnect(true);}
 }
 @SubscribeMessage('subscribe') async subscribe(@ConnectedSocket() socket:Socket,@MessageBody() b:{storeId:string,terminalId?:string,deviceId?:string}){
  try{const actor=await this.auth.authenticate(String(socket.handshake.auth.accessToken??''),socket.handshake.auth.counterToken);uuid(b.storeId);
   const context=await this.db.context(actor);if(context.store?.id!==b.storeId)throw new Error('Branch denied.');
   if(b.terminalId){const allowed=(await this.db.query('select 1 from app_private.terminals where store_id=$1 and id=$2 and owner_profile_id=$3',[b.storeId,b.terminalId,context.profile.id])).rowCount;if(!allowed)throw new Error('Terminal denied.');}
   let device:Record<string,unknown>|undefined;
   if(b.deviceId){uuid(b.deviceId);device=(await this.db.query('select * from app_private.staff_devices where id=$1 and store_id=$2 and owner_profile_id=$3 and current_session_id=$4',[b.deviceId,b.storeId,context.profile.id,actor.sessionId])).rows[0];if(!device)throw new Error('Phone denied.');}
   await socket.join('store:'+b.storeId);
   if(b.terminalId)await socket.join(`terminal:${b.storeId}:${b.terminalId}`);
   if(device){await socket.join(`device:${b.storeId}:${b.deviceId}`);socket.data.device={storeId:b.storeId,id:b.deviceId};await this.devicePresence(device,true);}
   return {ok:true};
  }catch{return {ok:false,message:'This device cannot subscribe to that counter.'};}
 }
 async handleDisconnect(socket:Socket){try{const ref=socket.data.device;if(!ref)return;const device=(await this.db.query('select * from app_private.staff_devices where store_id=$1 and id=$2',[ref.storeId,ref.id])).rows[0];if(device)await this.devicePresence(device,await this.deviceOnline(device));}catch{/* The gateway may disconnect sockets after the database pool has shut down. */}}
 async hasDevicePresence(storeId:string,deviceId:string){
  if(!this.server)return false;const device=(await this.db.query('select d.* from app_private.staff_devices d join app_private.sessions s on s.id=d.current_session_id where d.id=$1 and d.store_id=$2 and s.revoked_at is null and s.expires_at>now()',[deviceId,storeId])).rows[0];if(!device)return false;
  for(const socket of await this.server.in(`device:${storeId}:${deviceId}`).fetchSockets()){
   try{const actor=await this.auth.authenticate(String(socket.handshake.auth.accessToken??''),socket.handshake.auth.counterToken);if(actor.sessionId===device.current_session_id&&(await this.db.context(actor)).profile?.id===device.owner_profile_id)return true;await socket.leave(`device:${storeId}:${deviceId}`);}catch{socket.disconnect(true);}
  }return false;
 }
 private async deviceOnline(device:Record<string,unknown>){const valid=(await this.db.query('select 1 from app_private.sessions where id=$1 and revoked_at is null and expires_at>now()',[device.current_session_id])).rowCount;return Boolean(valid&&(new Date(String(device.last_seen_at)).getTime()>Date.now()-60000||await this.hasDevicePresence(String(device.store_id),String(device.id))));}
 private async refreshPresence(){if(!this.server)return;for(const device of (await this.db.query('select d.* from app_private.staff_devices d where exists(select 1 from app_private.device_pairings p where p.device_id=d.id and p.revoked_at is null and p.paired_at is not null)')).rows)await this.devicePresence(device,await this.deviceOnline(device));}
 async devicePresence(device:Record<string,unknown>,online:boolean){const key=String(device.id),previous=this.presence.get(key);this.presence.set(key,online);if(previous===online)return;for(const pair of (await this.db.query('select * from app_private.device_pairings where device_id=$1 and revoked_at is null and paired_at is not null',[device.id])).rows)await this.pairingEvent(pair,online?'device.online':'device.offline',online);}
 async pairingEvent(pair:Record<string,unknown>,event:string,online?:boolean){
  if(!this.server)return;const terminal=(await this.db.query('select * from app_private.terminals where store_id=$1 and id=$2',[pair.store_id,pair.terminal_id])).rows[0];
  const rooms=[`terminal:${pair.store_id}:${pair.terminal_id}`,'session:'+pair.device_session_id];if(terminal?.current_session_id)rooms.push('session:'+terminal.current_session_id);if(pair.device_id)rooms.push(`device:${pair.store_id}:${pair.device_id}`);
  const payload={id:pair.id,pairId:pair.id,storeId:pair.store_id,terminalId:pair.terminal_id,terminalName:terminal?.name,deviceId:pair.device_id??undefined,deviceName:pair.device_name,paired:event!=='device.unpaired',online};
  for(const socket of await this.server.in(rooms).fetchSockets()){
   try{const actor=await this.auth.authenticate(String(socket.handshake.auth.accessToken??''),socket.handshake.auth.counterToken);const context=await this.db.context(actor);if(context.store?.id!==pair.store_id)continue;const requester=context.profile?.id===pair.requester_id&&(actor.sessionId===terminal?.current_session_id||socket.rooms.has(`terminal:${pair.store_id}:${pair.terminal_id}`));const phone=actor.sessionId===pair.device_session_id&&context.profile?.id===pair.device_profile_id;if(requester||phone)socket.emit(event,payload);}catch{socket.disconnect(true);}
  }
 }
 async sendSession(sessionId:string,event:string,payload:unknown,profileId?:string){
  // Revalidate every recipient's session before sending private camera events.
  for(const socket of await this.server.in('session:'+sessionId).fetchSockets()){
   try{const actor=await this.auth.authenticate(String(socket.handshake.auth.accessToken??''),socket.handshake.auth.counterToken);if(!profileId||(await this.db.context(actor)).profile?.id===profileId)socket.emit(event,payload);}catch{socket.disconnect(true);}
  }
 }
 async camera(job:Record<string,unknown>,event:string){
  if(!this.server)return;const safe={id:job.id,terminalId:job.terminal_id,type:job.type,title:job.label,reference:job.reference,amount:job.amount===null?undefined:Number(job.amount),status:job.status,assignmentState:assignmentState(job),deviceId:job.device_id??undefined,createdAt:job.created_at,expiresAt:job.expires_at,mediaId:job.media_id??undefined,imagePath:job.image_path??undefined,imageUrl:job.imageUrl};
  const rooms=['session:'+job.requester_session_id,'session:'+job.device_session_id,`terminal:${job.store_id}:${job.terminal_id}`];if(job.device_id)rooms.push(`device:${job.store_id}:${job.device_id}`);
  for(const socket of await this.server.in(rooms).fetchSockets()){
   try{const actor=await this.auth.authenticate(String(socket.handshake.auth.accessToken??''),socket.handshake.auth.counterToken);const context=await this.db.context(actor);if(context.store?.id!==job.store_id)continue;const requester=context.profile?.id===job.requester_id&&(actor.sessionId===job.requester_session_id||Boolean((await this.db.query('select 1 from app_private.terminals where store_id=$1 and id=$2 and owner_profile_id=$3 and current_session_id=$4',[job.store_id,job.terminal_id,context.profile.id,actor.sessionId])).rowCount));const phone=context.profile?.id===job.device_profile_id&&actor.sessionId===job.device_session_id;if(requester||phone)socket.emit(event,safe);}catch{socket.disconnect(true);}
  }
 }
 async changed(_actor:Actor,storeId:string,resource:string){for(const socket of await this.server.in('store:'+storeId).fetchSockets()){try{const actor=await this.auth.authenticate(String(socket.handshake.auth.accessToken??''),socket.handshake.auth.counterToken);if((await this.db.context(actor)).store?.id===storeId)socket.emit('data.changed',{storeId,resource});else socket.disconnect(true);}catch{socket.disconnect(true);}}}
}
