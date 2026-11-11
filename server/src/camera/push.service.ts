import {BadRequestException,Inject,Injectable} from '@nestjs/common';
import webpush from 'web-push';
import {Database,type Actor} from '../database/database.service';
@Injectable()
export class PushService{
 readonly publicKey=process.env.VAPID_PUBLIC_KEY??'';
 constructor(@Inject(Database) private readonly db:Database){if(this.publicKey&&process.env.VAPID_PRIVATE_KEY)webpush.setVapidDetails(process.env.VAPID_SUBJECT??'mailto:owner@example.com',this.publicKey,process.env.VAPID_PRIVATE_KEY);}
 async subscribe(actor:Actor,b:webpush.PushSubscription){
  if(!this.publicKey)throw new BadRequestException('Web Push is not configured. Open Camera Requests on your phone.');
  if(!b.endpoint?.startsWith('https://')||!b.keys?.auth||!b.keys?.p256dh||b.endpoint.length>2048)throw new BadRequestException('Invalid push subscription.');
  // Avoid SSRF: Web Push endpoints must be recognized push-service providers.
  const host=new URL(b.endpoint).hostname;
  if(!['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'].some(x=>host===x||host.endsWith('.'+x)))throw new BadRequestException('Unsupported push service.');
  const context=await this.db.context(actor);await this.db.query('insert into app_private.push_subscriptions(session_id,profile_id,endpoint,subscription) values($1,$2,$3,$4) on conflict(endpoint) do update set session_id=excluded.session_id,profile_id=excluded.profile_id,subscription=excluded.subscription',[actor.sessionId,context.profile.id,b.endpoint,b]);return {ok:true};
 }
 async remove(actor:Actor,endpoint:string){await this.db.query('delete from app_private.push_subscriptions where session_id=$1 and endpoint=$2',[actor.sessionId,endpoint]);return {ok:true};}
 async notify(sessionId:string,jobId:string){if(!this.publicKey)return;const rows=(await this.db.query('select id,subscription from app_private.push_subscriptions where session_id=$1',[sessionId])).rows;
  await Promise.all(rows.map(async r=>{try{await webpush.sendNotification(r.subscription,JSON.stringify({title:'Camera request',body:'Open Taha POS to capture the requested image.',url:'/mobile-camera?job='+jobId}),{TTL:600});}catch(e){if([404,410].includes(Number((e as {statusCode?:number}).statusCode)))await this.db.query('delete from app_private.push_subscriptions where id=$1',[r.id]);}}));
 }
}
