import assert from 'node:assert/strict';
import {after,before,beforeEach,test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {mkdtemp} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';
import sharp from 'sharp';
import {migrate,runtimeRole} from '../scripts/migrate';
import {hashPassword} from '../src/auth/crypto';
import type {INestApplication} from '@nestjs/common';
import {io,type Socket} from 'socket.io-client';

const adminUrl=process.env.TAHA_TEST_POSTGRES_URL??'postgresql://taha_test@127.0.0.1:55439/postgres';
const admin=new pg.Client({connectionString:adminUrl});let db:pg.Client,app:INestApplication,url:string;
const store='10000000-0000-4000-8000-000000000001',owner=randomUUID(),employee=randomUUID(),other=randomUUID();
const password='Secure test password 2026!';let ownerAuth:{accessToken:string},phoneAuth:{accessToken:string},employeeAuth:{accessToken:string};
const origin='http://localhost:5173';
// Each test owns its camera session; completed/cancelled fixtures cannot overlap the next test.
beforeEach(async()=>{if(db)await db.query("update app_private.camera_jobs set status='cancelled' where status not in ('received','cancelled','expired')");});
async function api(route:string,method='GET',body?:unknown,token?:string,cookie?:string){const response=await fetch(url+'/api/v1'+route,{method,headers:{Origin:origin,...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{}),...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});const text=await response.text();let data:any;try{data=JSON.parse(text);}catch{data=text;}return {status:response.status,data,cookie:response.headers.get('set-cookie')?.split(';')[0]};}
before(async()=>{
 const parsed=new URL(adminUrl);assert(['localhost','127.0.0.1'].includes(parsed.hostname)&&parsed.pathname==='/postgres','Use a local test administrator URL only.');
 await admin.connect();const database='taha_api_test_'+Date.now();await admin.query(`create database ${database}`);parsed.pathname='/'+database;
 db=new pg.Client({connectionString:parsed.toString()});await db.connect();await migrate(db);
 const runtimeUrl=new URL(parsed);runtimeUrl.username='taha_api_test';runtimeUrl.password='test-runtime-password';await runtimeRole(db,runtimeUrl.toString());
 const hash=await hashPassword(password);
 for(const [id,email,name,role] of [[owner,'owner@taha.test','Ahmed Khan','owner'],[employee,'employee@taha.test','Hamza','employee'],[other,'other@taha.test','Ali','employee']]){
  await db.query('insert into auth.users(id,email) values($1,$2)',[id,email]);await db.query("insert into public.profiles(id,full_name,email,role,status) values($1,$2,$3,$4,'active')",[id,name,email,role]);await db.query('insert into public.store_memberships(profile_id,store_id) values($1,$2)',[id,store]);await db.query('insert into app_private.accounts(user_id,email,password_hash) values($1,$2,$3)',[id,email,hash]);
 }
 await db.query("insert into public.employee_permissions(profile_id,store_id,permission_id,enabled) select $1,$2,id,true from public.permissions where key in ('sales.create','devices.pair','media.upload')",[employee,store]);
 process.env.DATABASE_URL=runtimeUrl.toString();process.env.JWT_SECRET='test-secret-is-random-enough-only-used-in-isolated-tests';process.env.PORT='0';process.env.FRONTEND_ORIGIN=origin;process.env.MOBILE_APP_ORIGIN='http://localhost';process.env.NODE_ENV='test';process.env.STORAGE_ROOT=await mkdtemp(path.join(os.tmpdir(),'taha-api-media-'));
 const {createApp}=await import('../src/main');app=await createApp();await app.listen(0,'127.0.0.1');url=await app.getUrl();
 ownerAuth=(await api('/auth/login','POST',{email:'owner@taha.test',password})).data;
 phoneAuth=(await api('/auth/login','POST',{email:'owner@taha.test',password,deviceName:'Staff Phone'})).data;
 employeeAuth=(await api('/auth/login','POST',{email:'employee@taha.test',password})).data;
},{timeout:120000});
after(async()=>{await app?.close();await db?.end();await admin.end();});

test('real PostgreSQL runtime login is neither superuser nor RLS bypass; public cost access is denied',async()=>{
 const role=(await db.query("select rolsuper,rolbypassrls from pg_roles where rolname='taha_api_test'")).rows[0];assert.equal(role.rolsuper,false);assert.equal(role.rolbypassrls,false);
 const client=new pg.Client({connectionString:process.env.DATABASE_URL});await client.connect();try{await assert.rejects(client.query('select * from public.product_financials'),/permission denied/);}finally{await client.end();}
});
test('bundled Android origin can authenticate and rotate an HttpOnly native cookie without returning it to JS',async()=>{
 const headers={Origin:'http://localhost','Content-Type':'application/json'};
 const login=await fetch(url+'/api/v1/auth/login',{method:'POST',headers,body:JSON.stringify({email:'owner@taha.test',password,deviceName:'Android bundled test'})});
 assert.equal(login.status,201);assert.equal(login.headers.get('access-control-allow-origin'),'http://localhost');
 const body=await login.json() as any;assert(body.accessToken);assert.equal(body.refreshToken,undefined);
 const cookie=login.headers.get('set-cookie')!;assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Strict/);
 const refresh=await fetch(url+'/api/v1/auth/refresh',{method:'POST',headers:{...headers,Cookie:cookie.split(';')[0]}});assert.equal(refresh.status,201);assert.notEqual(refresh.headers.get('set-cookie')?.split(';')[0],cookie.split(';')[0]);
});

test('receipt defaults use Taha Mobiles wording and preserve customized footers',async()=>{
 const settings=await api(`/stores/${store}/settings`,'GET',undefined,ownerAuth.accessToken);assert.equal(settings.data.receiptFooter,'Thank you for choosing Taha Mobiles.');
 const fresh=randomUUID();await db.query("insert into public.stores(id,name,branch_name) values($1,'Taha Mobiles','Test branch')",[fresh]);
 assert.equal((await db.query('select private.settings($1) settings',[fresh])).rows[0].settings.receiptFooter,'Thank you for choosing Taha Mobiles.');
 await db.query("update public.business_settings set settings=jsonb_set(settings,'{receiptFooter}','\"A custom shop footer\"'::jsonb) where store_id=$1",[fresh]);await migrate(db);
 assert.equal((await db.query('select private.settings($1) settings',[fresh])).rows[0].settings.receiptFooter,'A custom shop footer');
});
test('custom auth and rotating refresh tokens revoke a replayed token family',async()=>{
 const login=await api('/auth/login','POST',{email:'owner@taha.test',password});assert.equal(login.status,201);assert(login.cookie);assert.equal(login.data.context.profile.full_name,'Ahmed Khan');assert(login.data.context.permissions.includes('services.create_custom'));
 const refresh=await api('/auth/refresh','POST',{},undefined,login.cookie);assert.equal(refresh.status,201);assert.notEqual(refresh.cookie,login.cookie);
 assert.equal((await api('/auth/refresh','POST',{},undefined,login.cookie)).status,401);
 assert.equal((await api('/auth/session','GET',undefined,refresh.data.accessToken)).status,401);
 const secrets=(await db.query('select token_hash from app_private.refresh_tokens')).rows;assert(secrets.every(r=>/^[a-f0-9]{64}$/.test(r.token_hash)&&!login.cookie?.includes(r.token_hash)));
 assert.equal((await api('/auth/login','POST',{email:'owner@taha.test',password:'wrong'})).status,401);
});
test('origin guard, protected routes, branch and cost/profit permissions are enforced server-side',async()=>{
 assert.equal((await fetch(url+'/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://evil.example'},body:JSON.stringify({email:'owner@taha.test',password})})).status,403);
 assert.equal((await api(`/stores/${store}/products/pos`)).status,401);
 const financial=await api(`/stores/${store}/profit`,'GET',undefined,employeeAuth.accessToken);assert.equal(financial.status,403);assert(!JSON.stringify(financial.data).includes('purchase_cost'));
 assert.equal((await api(`/stores/${randomUUID()}/products/pos`,'GET',undefined,employeeAuth.accessToken)).status,403);
});
test('atomic custom service invoice keeps snapshot, negotiation discount, no stock and idempotency',async()=>{
 const methods=await api(`/stores/${store}/payment-methods`,'GET',undefined,ownerAuth.accessToken);const cash=methods.data.find((x:any)=>x.kind==='Cash').id;
 const input={idempotencyKey:randomUUID(),cartId:randomUUID(),lines:[{productId:'custom:'+randomUUID(),customService:{name:'Charging port cleaning',description:'Customer requested cleaning',sellingPrice:800,minimumSellingPrice:500},quantity:1,unitPrice:700,reason:'Customer bargaining'}],payments:[{methodId:cash,amount:700}],cashReceived:1000};
 const response=await api(`/stores/${store}/sales`,'POST',input,ownerAuth.accessToken);assert.equal(response.status,201,JSON.stringify(response.data));assert.equal(response.data.total,700);assert.equal(response.data.discount,100);assert.equal(response.data.change,300);assert.equal(response.data.lines[0].name,'Charging port cleaning');assert.equal(response.data.lines[0].service,true);assert.deepEqual(response.data.lines[0].stockAllocations,[]);assert.match(response.data.invoice,/TM-INV-/);
 const retry=await api(`/stores/${store}/sales`,'POST',input,ownerAuth.accessToken);assert.equal(retry.data.id,response.data.id);
 assert.equal((await db.query("select count(*)::int n from public.stock_movements where movement_type='SALE'")).rows[0].n,0);
 assert.equal((await api(`/stores/${store}/sales`,'POST',{...input,lines:input.lines.map(l=>({...l,unitPrice:650}))},ownerAuth.accessToken)).status,422);
 assert.equal((await api(`/stores/${store}/sales`,'POST',{...input,idempotencyKey:randomUUID()},employeeAuth.accessToken)).status,403);
});
test('camera pairing consumes code once; queues and uploads isolate sessions/terminals',async()=>{
 const pair=await api(`/stores/${store}/camera/pairing`,'POST',{terminalId:'counter-A'},ownerAuth.accessToken);assert.equal(pair.status,201);assert.match(pair.data.code,/^[0-9]{6}$/);
 assert.equal((await api(`/stores/${store}/camera/pair`,'POST',{code:pair.data.code,deviceName:'Samsung Phone'},phoneAuth.accessToken)).status,201);
 const ownerDevices=(await api(`/stores/${store}/camera/devices`,'GET',undefined,ownerAuth.accessToken)).data;
 const phoneDevices=(await api(`/stores/${store}/camera/devices`,'GET',undefined,phoneAuth.accessToken)).data;
 assert.equal(ownerDevices.find((device:any)=>device.terminalId==='counter-A').pairedToThisDevice,false);
 assert.equal(phoneDevices.find((device:any)=>device.terminalId==='counter-A').pairedToThisDevice,true);
 assert.equal((await api(`/stores/${store}/camera/pair`,'POST',{code:pair.data.code,deviceName:'Replay Phone'},phoneAuth.accessToken)).status,400);
 const job=await api(`/stores/${store}/camera/jobs`,'POST',{terminalId:'counter-A',type:'payment-proof',label:'Payment proof',reference:'Draft 1',amount:12500},ownerAuth.accessToken);assert.equal(job.status,201);
 assert.equal((await api(`/stores/${store}/camera/jobs?terminalId=counter-B`,'GET',undefined,ownerAuth.accessToken)).data.length,0);
 assert.equal((await api(`/stores/${store}/camera/jobs`,'GET',undefined,employeeAuth.accessToken)).data.length,0);
 assert.equal((await api(`/stores/${store}/camera/jobs`,'GET',undefined,phoneAuth.accessToken)).data[0].id,job.data.id);
 assert.equal((await api(`/stores/${store}/camera/jobs/${job.data.id}`,'PATCH',{status:'opened'},ownerAuth.accessToken)).status,403);
 assert.equal((await api(`/stores/${store}/camera/jobs/${job.data.id}`,'PATCH',{status:'opened',mediaId:randomUUID()},phoneAuth.accessToken)).status,400);
 for(const status of ['opened','opened','captured','opened','captured','captured','uploading','opened','captured','uploading','uploading'])assert.equal((await api(`/stores/${store}/camera/jobs/${job.data.id}`,'PATCH',{status},phoneAuth.accessToken)).status,200,`Phone retry/retake ${status} must succeed`);
 const wrong=await api(`/stores/${store}/camera/jobs/${job.data.id}`,'PATCH',{status:'received',mediaId:randomUUID()},phoneAuth.accessToken);assert.equal(wrong.status,400);
 const image=await sharp({create:{width:200,height:100,channels:3,background:'#ffc107'}}).jpeg().toBuffer();const form=new FormData();form.set('kind','payment-proof');form.set('cameraJobId',job.data.id);form.set('file',new Blob([image],{type:'image/jpeg'}),'proof.jpg');
 const upload=await fetch(url+`/api/v1/stores/${store}/media`,{method:'POST',headers:{Authorization:'Bearer '+phoneAuth.accessToken,Origin:origin},body:form});const media=await upload.json() as any;assert.equal(upload.status,201,JSON.stringify(media));assert.equal(media.mimeType,'image/webp');assert(media.size<image.length+1000);
 const received=await api(`/stores/${store}/camera/jobs/${job.data.id}`,'PATCH',{status:'received',mediaId:media.id},phoneAuth.accessToken);assert.equal(received.status,200);assert(received.data.imageUrl);
 assert.equal((await api(`/stores/${store}/camera/jobs/${job.data.id}`,'PATCH',{status:'received',mediaId:media.id},phoneAuth.accessToken)).status,200);
 const paths=await api(`/stores/${store}/media/urls`,'POST',{paths:[media.path]},ownerAuth.accessToken);assert(paths.data[media.path]);
 const forbidden=await api(`/stores/${store}/media/urls`,'POST',{paths:[media.path]},employeeAuth.accessToken);assert.deepEqual(forbidden.data,{});
 const signed=new URL(paths.data[media.path]);const read=await fetch(url+signed.pathname+signed.search);assert.equal(read.status,200);assert.equal(read.headers.get('content-type'),'image/webp');assert.equal(read.headers.get('cross-origin-resource-policy'),'cross-origin');
 assert.equal((await api(`/stores/${store}/media/${media.id}`,'DELETE',{},ownerAuth.accessToken)).status,400);
});
test('remote display capability exposes only its paired terminal, drops stale carts and cannot query staff APIs',async()=>{
 const display=await api('/displays','POST',{deviceName:'Customer TV'});assert.equal(display.status,201,JSON.stringify(display.data));
 const {displaySessionId,pairingCode,displayToken}=display.data;assert.match(pairingCode,/^[0-9A-F]{8}$/);assert(displayToken);
 assert.equal((await api(`/displays/${displaySessionId}`,'GET',undefined,displayToken)).data.status,'waiting');
 const paired=await api(`/stores/${store}/displays/pair`,'POST',{pairingCode,terminalId:'counter-TV'},ownerAuth.accessToken);assert.equal(paired.status,201);
 assert.equal((await api(`/stores/${store}/displays/pair`,'POST',{pairingCode,terminalId:'counter-B'},ownerAuth.accessToken)).status,400);
 const snapshot={mode:'CART_ACTIVE',terminalId:'counter-TV',items:[{id:'1',name:'iPhone 13 Battery',variant:'Original',quantity:2,unitPrice:3600}],subtotal:7200,discount:0,total:7200};
 assert.equal((await api(`/stores/${store}/displays/${displaySessionId}`,'PUT',{terminalId:'counter-TV',snapshot},ownerAuth.accessToken)).status,200);
 const current=await api(`/displays/${displaySessionId}`,'GET',undefined,displayToken);assert.equal(current.data.status,'paired');assert.equal(current.data.snapshot.total,7200);assert.equal(current.data.terminalId,'counter-TV');
 const management=await api(`/stores/${store}/displays?terminalId=counter-TV`,'GET',undefined,ownerAuth.accessToken);assert.equal(management.data[0].online,true);
 assert.equal((await api(`/stores/${store}/displays/${displaySessionId}`,'PUT',{terminalId:'counter-B',snapshot},ownerAuth.accessToken)).status,403);
 assert.equal((await api(`/stores/${store}/displays/${displaySessionId}`,'PUT',{terminalId:'counter-TV',snapshot},employeeAuth.accessToken)).status,403);
 for(const privateField of ['purchaseCost','minimumSellingPrice','profit','stockLocation','customerCreditHistory','employeeControls'])assert.equal((await api(`/stores/${store}/displays/${displaySessionId}`,'PUT',{terminalId:'counter-TV',snapshot:{...snapshot,[privateField]:1}},ownerAuth.accessToken)).status,400);
 assert.equal((await api(`/stores/${store}/products/pos`,'GET',undefined,displayToken)).status,401);
 await db.query("update app_private.display_sessions set snapshot_updated_at=now()-interval '11 seconds' where id=$1",[displaySessionId]);
 const stale=await api(`/displays/${displaySessionId}`,'GET',undefined,displayToken);assert.equal(stale.data.snapshot.mode,'IDLE');assert.deepEqual(stale.data.snapshot.items,[]);
 await api(`/stores/${store}/displays/${displaySessionId}`,'DELETE',{},ownerAuth.accessToken);
 assert.equal((await api(`/displays/${displaySessionId}`,'GET',undefined,displayToken)).status,401);
});
test('staff identities are owner provisioned, passwords configured server-side, current password required and other sessions revoked',async()=>{
 const profileId=randomUUID();const input={id:profileId,full_name:'New Counter Employee',email:'newstaff@taha.test',phone:'03001234567',role:'employee',status:'active',permissions:['sales.create','media.upload']};
 assert.equal((await api(`/stores/${store}/employees`,'POST',input,employeeAuth.accessToken)).status,403);
 const create=await api(`/stores/${store}/employees`,'POST',input,ownerAuth.accessToken);assert.equal(create.status,201,JSON.stringify(create.data));
 assert.equal((await api(`/stores/${store}/accounts`,'POST',{profileId,email:input.email,password},ownerAuth.accessToken)).status,201);
 const first=await api('/auth/login','POST',{email:input.email,password});const second=await api('/auth/login','POST',{email:input.email,password});assert.equal(first.status,201);assert.equal(second.status,201);
 assert.equal((await api('/auth/change-password','POST',{currentPassword:'wrong',newPassword:'Another secure passphrase 2026!'},first.data.accessToken)).status,401);
 const changed=await api('/auth/change-password','POST',{currentPassword:password,newPassword:'Another secure passphrase 2026!'},first.data.accessToken);assert.equal(changed.status,201);
 assert.equal((await api('/auth/session','GET',undefined,first.data.accessToken)).status,200);assert.equal((await api('/auth/session','GET',undefined,second.data.accessToken)).status,401);
 const devices=await api('/auth/devices','GET',undefined,first.data.accessToken);assert.equal(devices.data.length,1);assert.equal(devices.data[0].current,true);assert(!JSON.stringify(devices.data).includes('token'));
 assert.equal((await api('/auth/login','POST',{email:input.email,password:'Another secure passphrase 2026!'})).status,201);
});
test('profile media persists only to its owner, signed links require active sessions, malformed photos rejected',async()=>{
 const image=await sharp({create:{width:60,height:60,channels:3,background:'#e53935'}}).png().toBuffer();const form=new FormData();form.set('kind','profile');form.set('file',new Blob([image],{type:'image/png'}),'avatar.png');
 const upload=await fetch(url+`/api/v1/stores/${store}/media`,{method:'POST',headers:{Authorization:'Bearer '+employeeAuth.accessToken,Origin:origin},body:form});const media=await upload.json() as any;assert.equal(upload.status,201);
 const updated=await api(`/stores/${store}/profile`,'PATCH',{fullName:'Hamza',phone:'03000000000',avatarPath:media.path},employeeAuth.accessToken);assert.equal(updated.status,200);
 assert.equal((await api('/auth/session','GET',undefined,employeeAuth.accessToken)).data.profile.avatar_url,media.path);
 assert.equal((await api(`/stores/${store}/profile`,'PATCH',{fullName:'Ahmed Khan',phone:'',avatarPath:media.path},ownerAuth.accessToken)).status,400);
 const malformed=new FormData();malformed.set('kind','profile');malformed.set('file',new Blob(['not an image'],{type:'image/jpeg'}),'fake.jpg');assert.equal((await fetch(url+`/api/v1/stores/${store}/media`,{method:'POST',headers:{Authorization:'Bearer '+employeeAuth.accessToken,Origin:origin},body:malformed})).status,400);
});
test('WebSocket scope denies unauthorized terminal subscription and delivers camera job only to assigned sessions',async()=>{
 const sockets:Socket[]=[];const connect=async(token:string)=>{const socket=io(url+'/counter',{transports:['websocket'],auth:{accessToken:token},extraHeaders:{Origin:origin},reconnection:false});sockets.push(socket);await new Promise<void>((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});return socket;};
 try{
  const desktop=await connect(ownerAuth.accessToken),phone=await connect(phoneAuth.accessToken),unrelated=await connect(employeeAuth.accessToken);
  const subscribe=(socket:Socket,terminalId:string)=>new Promise<any>(resolve=>socket.emit('subscribe',{storeId:store,terminalId},resolve));
  assert.equal((await subscribe(unrelated,'counter-A')).ok,false);assert.equal((await subscribe(desktop,'counter-A')).ok,true);
  let unintended=0;unrelated.on('camera.requested',()=>unintended++);
  const received=new Promise<any>(resolve=>phone.once('camera.requested',resolve));
  const request=await api(`/stores/${store}/camera/jobs`,'POST',{terminalId:'counter-A',type:'product-photo',label:'Product photo'},ownerAuth.accessToken);assert.equal(request.status,201);
  const event=await Promise.race([received,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Camera event timed out')),3000))]);assert.equal(event.id,request.data.id);assert.equal(event.type,'product');assert.equal(unintended,0);assert(!JSON.stringify(event).includes('requester_session_id'));
 }finally{sockets.forEach(s=>s.disconnect());}
});
test('Swagger and health exist in development; arbitrary RPC and signup do not',async()=>{
 assert.equal((await fetch(url+'/api/docs')).status,200);const doc=await (await fetch(url+'/api/docs-json')).json() as any;assert(doc.paths['/api/v1/auth/login']);
 const health=(await api('/health')).data;assert.equal(health.status,'ok');assert.equal(health.database,'connected');assert.equal(typeof health.version,'string');assert.ok(Date.parse(health.timestamp));assert.equal((await api('/rpc/complete_sale','POST',{},ownerAuth.accessToken)).status,404);assert.equal((await api('/auth/signup','POST',{email:'intruder@taha.test',password})).status,404);
});
test('disconnecting a phone cancels its pending captures and blocks progress',async()=>{
 const pairing=await api(`/stores/${store}/camera/pairing`,'POST',{terminalId:'disconnect-counter'},ownerAuth.accessToken);
 await api(`/stores/${store}/camera/pair`,'POST',{code:pairing.data.code,deviceName:'Temporary phone'},phoneAuth.accessToken);
 const job=await api(`/stores/${store}/camera/jobs`,'POST',{terminalId:'disconnect-counter',type:'profile',label:'Profile photo',deviceId:pairing.data.id},ownerAuth.accessToken);
 assert.equal(job.status,201);await api(`/stores/${store}/camera/devices/${pairing.data.id}`,'DELETE',{},ownerAuth.accessToken);
 assert.equal((await api(`/stores/${store}/camera/jobs/${job.data.id}`,'PATCH',{status:'opened'},phoneAuth.accessToken)).status,400);
 const queue=await api(`/stores/${store}/camera/jobs?terminalId=disconnect-counter`,'GET',undefined,ownerAuth.accessToken);assert.equal(queue.data[0].status,'cancelled');
});
test('appearance is readable by staff and settings administrators can edit the validated theme',async()=>{
 const current=await api(`/stores/${store}/appearance`,'GET',undefined,employeeAuth.accessToken);assert.equal(current.status,200);
 assert.equal((await api(`/stores/${store}/appearance`,'PUT',current.data,employeeAuth.accessToken)).status,403);
 await db.query("insert into public.employee_permissions(profile_id,store_id,permission_id,enabled) select $1,$2,id,true from public.permissions where key='settings.manage'",[other,store]);
 const actor=(await api('/auth/login','POST',{email:'other@taha.test',password})).data;
 assert.equal((await api(`/stores/${store}/appearance`,'PUT',current.data,actor.accessToken)).status,200);
});
test('used-device photos persist as private paths while purchase price is excluded without its grant',async()=>{
 const rack=randomUUID(),shelf=randomUUID(),box=randomUUID(),id=randomUUID();
 for(const input of [{id:rack,name:'Device rack',kind:'rack'},{id:shelf,name:'A',kind:'shelf',parent_id:rack},{id:box,name:'01',kind:'box',parent_id:shelf}])assert.equal((await api(`/stores/${store}/locations`,'POST',input,ownerAuth.accessToken)).status,201);
 const image=await sharp({create:{width:70,height:70,channels:3,background:'#ffc107'}}).jpeg().toBuffer();const form=new FormData();form.set('kind','device');form.set('entityId',id);form.set('file',new Blob([image],{type:'image/jpeg'}),'device.jpg');
 const upload=await fetch(url+`/api/v1/stores/${store}/media`,{method:'POST',headers:{Authorization:'Bearer '+ownerAuth.accessToken,Origin:origin},body:form});const photo=await upload.json() as any;assert.equal(upload.status,201);
 const input={id,seller:'Test Seller',phone:'03001234567',brand:'Samsung',model:'A15',storage:'128GB',color:'Black',purchasePrice:20000,targetPrice:25000,minimumPrice:23000,locationId:box,photos:[photo.path]};
 const purchased=await api(`/stores/${store}/devices`,'POST',input,ownerAuth.accessToken);assert.equal(purchased.status,201,JSON.stringify(purchased.data));assert.deepEqual(purchased.data.photos,[photo.path]);
 await db.query("insert into public.employee_permissions(profile_id,store_id,permission_id,enabled) select $1,$2,id,true from public.permissions where key='devices.buy_used'",[employee,store]);
 const list=await api(`/stores/${store}/devices`,'GET',undefined,employeeAuth.accessToken);assert.equal(list.status,200);assert.equal(list.data.find((device:any)=>device.id===id).purchasePrice,undefined);assert(!JSON.stringify(list.data).includes('purchase_cost'));
 assert.equal((await api(`/stores/${store}/devices`,'POST',{...input,id:randomUUID(),photos:['https://private.example/proof.jpg']},ownerAuth.accessToken)).status,422);
});
test('custom-service coupon preview enforces the server floor and leaves no catalog or stock records',async()=>{
 const coupon={id:randomUUID(),code:'CUSTOM10',type:'Percentage',value:10,start:'2026-01-01',end:'2030-12-31',minimum:0,maxUses:0,perCustomerLimit:0,eligible:'Services',targets:[],active:true};
 assert.equal((await api(`/stores/${store}/coupons`,'POST',coupon,ownerAuth.accessToken)).status,201);
 const settings=await api(`/stores/${store}/settings`,'GET',undefined,ownerAuth.accessToken);await api(`/stores/${store}/settings`,'PUT',{...settings.data,customServiceMinimum:600},ownerAuth.accessToken);
 const count=(await db.query('select count(*)::int n from public.products')).rows[0].n;
 const lines=[{productId:'custom:'+randomUUID(),quantity:1,unitPrice:700,customService:{name:'Charging port clean',sellingPrice:800,minimumSellingPrice:500}}];
 const quote=await api(`/stores/${store}/coupons/quote`,'POST',{code:coupon.code,lines},ownerAuth.accessToken);assert.equal(quote.status,201,JSON.stringify(quote.data));assert.equal(quote.data.discount,70);
 const limited=await api(`/stores/${store}/coupons/quote`,'POST',{code:coupon.code,lines:[{...lines[0],unitPrice:620}]},ownerAuth.accessToken);assert.equal(limited.data.discount,20);
 assert.equal((await api(`/stores/${store}/coupons/quote`,'POST',{code:coupon.code,lines},employeeAuth.accessToken)).status,403);
 assert.equal((await api(`/stores/${store}/coupons/quote`,'POST',{code:coupon.code,lines:[{...lines[0],customService:{...lines[0].customService,sellingPrice:500}}]},ownerAuth.accessToken)).status,422);
 assert.equal((await db.query('select count(*)::int n from public.products')).rows[0].n,count);
 assert.equal((await db.query("select count(*)::int n from public.stock_movements where movement_type='SALE'")).rows[0].n,0);
 await api(`/stores/${store}/settings`,'PUT',settings.data,ownerAuth.accessToken);
});


test('catalog HTTP reads preserve PostgreSQL timestamp precision for optimistic edits',async()=>{
 const product=randomUUID();await db.query("insert into public.products(id,store_id,name,category,selling_price,minimum_selling_price,created_by,updated_at) values($1,$2,'Precision catalog edit','Parts',1500,1000,$3,'2026-10-05T10:00:00.123456Z')",[product,store,owner]);
 const row=await api('/stores/'+store+'/products/'+product,'GET',undefined,ownerAuth.accessToken);assert.equal(row.status,200);assert.match(row.data.updated_at,/123456/);
 const saved=await api('/stores/'+store+'/products','POST',{id:product,name:'Precision catalog edit',category:'Parts',selling_price:1600,minimum_selling_price:1000,expected_updated_at:row.data.updated_at},ownerAuth.accessToken);assert.equal(saved.status,201);
 const conflict=await api('/stores/'+store+'/products','POST',{id:product,name:'Stale edit',category:'Parts',selling_price:1700,minimum_selling_price:1000,expected_updated_at:row.data.updated_at},ownerAuth.accessToken);assert.equal(conflict.status,409);
});


test('custom service coupon preview uses existing rules without catalog writes',async()=>{
 const code='PREVIEW'+Date.now();const saved=await api('/stores/'+store+'/coupons','POST',{id:randomUUID(),code,type:'Fixed',value:150,minimum:0,start:'2026-01-01',end:'2099-12-31',active:true,eligible:'Services',targets:[],maxUses:0,perCustomerLimit:0},ownerAuth.accessToken);assert.equal(saved.status,201,JSON.stringify(saved.data));
 const before=(await db.query('select count(*) n from public.products where store_id=$1',[store])).rows[0].n;
 const lines=[{productId:'custom:'+randomUUID(),quantity:1,unitPrice:1000,customService:{name:'Coupon diagnostic',description:'One-off service',sellingPrice:1000,minimumSellingPrice:900}}];
 const quoted=await api('/stores/'+store+'/coupons/quote','POST',{code,lines},ownerAuth.accessToken);assert.equal(quoted.status,201);assert.equal(quoted.data.discount,100);
 assert.equal((await db.query('select count(*) n from public.products where store_id=$1',[store])).rows[0].n,before);
 const invalid=await api('/stores/'+store+'/coupons/quote','POST',{code,lines:[{...lines[0],customService:{...lines[0].customService,minimumSellingPrice:1100}}]},ownerAuth.accessToken);assert.equal(invalid.status,422);
});

test('instant camera captures atomically complete, retry without duplicates, ignore target spoof and serve thumbnails',async()=>{
 const pair=await api(`/stores/${store}/camera/pairing`,'POST',{terminalId:'instant-counter'},ownerAuth.accessToken);
 assert.match(pair.data.code,/^\d{6}$/);await api(`/stores/${store}/camera/pair`,'POST',{code:pair.data.code,deviceName:'Instant phone'},phoneAuth.accessToken);
 const job=await api(`/stores/${store}/camera/jobs`,'POST',{terminalId:'instant-counter',type:'product-photo',label:'Samsung A15',entityId:'immutable-draft',maxCaptures:3,targetSlot:'hacked'},ownerAuth.accessToken);assert.equal(job.status,201);assert.equal(job.data.targetSlot,'images.gallery');assert(job.data.qrPayload);
 const image=await sharp({create:{width:1200,height:800,channels:3,background:'#ffc107'}}).jpeg().toBuffer(),captureId=randomUUID();
 const upload=async(id:string,token=phoneAuth.accessToken,bytes=image)=>{const form=new FormData();form.set('captureId',id);form.set('file',new Blob([bytes],{type:'image/jpeg'}),'photo.jpg');const r=await fetch(url+`/api/v1/stores/${store}/camera/jobs/${job.data.id}/captures`,{method:'POST',headers:{Origin:'http://localhost',Authorization:'Bearer '+token},body:form});return {status:r.status,data:await r.json() as any};};
 assert.equal((await upload(randomUUID(),employeeAuth.accessToken)).status,404);
 const [one,duplicate]=await Promise.all([upload(captureId),upload(captureId)]);assert.equal(one.status,201,JSON.stringify(one.data));assert.equal(duplicate.data.capture.mediaId,one.data.capture.mediaId);assert.equal(one.data.captures.length,1);assert.equal(one.data.status,'opened');
 assert.equal((await db.query('select count(*)::int n from app_private.media where camera_job_id=$1',[job.data.id])).rows[0].n,1);
 assert.equal((await db.query('select entity_id from app_private.media where id=$1',[one.data.capture.mediaId])).rows[0].entity_id,'immutable-draft');
 const changed=await sharp(image).negate().jpeg().toBuffer();assert.equal((await upload(captureId,phoneAuth.accessToken,changed)).status,409);
 const thumb=new URL(one.data.capture.thumbnailUrl);const thumbnail=await fetch(url+thumb.pathname+thumb.search);assert.equal(thumbnail.status,200);assert.equal((await sharp(Buffer.from(await thumbnail.arrayBuffer())).metadata()).width,360);
 const second=await upload(randomUUID());assert.equal(second.data.captures.length,2);const finished=await api(`/stores/${store}/camera/jobs/${job.data.id}/finish`,'POST',{},phoneAuth.accessToken);assert.equal(finished.data.status,'received');assert.equal((await upload(randomUUID())).status,400);assert.equal((await upload(captureId)).status,201);
});

test('QR fallback claims once, denies wrong staff and revoked/expired capture, diagnostics cleans temporary files',async()=>{
 const job=await api(`/stores/${store}/camera/jobs`,'POST',{terminalId:'qr-counter',type:'document',label:'Document',fallback:true},ownerAuth.accessToken);assert.equal(job.status,201);
 const qr=new URL(job.data.qrPayload),token=qr.searchParams.get('token');assert.equal((await api(`/stores/${store}/camera/jobs/${job.data.id}/claim`,'POST',{token:'0'.repeat(48)},phoneAuth.accessToken)).status,400);
 const claim=await api(`/stores/${store}/camera/jobs/${job.data.id}/claim`,'POST',{token},phoneAuth.accessToken);assert.equal(claim.status,201);assert.equal((await api(`/stores/${store}/camera/jobs/${job.data.id}/claim`,'POST',{token},employeeAuth.accessToken)).status,400);
 await api(`/stores/${store}/camera/jobs/${job.data.id}`,'PATCH',{status:'cancelled'},ownerAuth.accessToken);
 const photo=await sharp({create:{width:100,height:100,channels:3,background:'#e53935'}}).jpeg().toBuffer();
 const upload=async(id:string,captureId=randomUUID())=>{const f=new FormData();f.set('captureId',captureId);f.set('file',new Blob([photo],{type:'image/jpeg'}),'photo.jpg');return fetch(url+`/api/v1/stores/${store}/camera/jobs/${id}/captures`,{method:'POST',headers:{Origin:'http://localhost',Authorization:'Bearer '+phoneAuth.accessToken},body:f});};
 assert.equal((await upload(job.data.id)).status,400);
 const testJob=await api(`/stores/${store}/camera/test`,'POST',{},phoneAuth.accessToken);assert.equal(testJob.status,201);const uploadTest=await upload(testJob.data.id);assert.equal(uploadTest.status,201);const result=await uploadTest.json() as any;
 assert.equal((await api(`/stores/${store}/camera/jobs/${testJob.data.id}/test`,'DELETE',{},employeeAuth.accessToken)).status,404);assert.equal((await api(`/stores/${store}/camera/jobs/${testJob.data.id}/test`,'DELETE',{},phoneAuth.accessToken)).status,200);const image=new URL(result.capture.imageUrl);assert.equal((await fetch(url+image.pathname+image.search)).status,404);
 const expired=await api(`/stores/${store}/camera/jobs`,'POST',{terminalId:'instant-counter',type:'product',label:'Expired'},ownerAuth.accessToken);await db.query("update app_private.camera_jobs set expires_at=now()-interval '1 minute' where id=$1",[expired.data.id]);assert.equal((await upload(expired.data.id)).status,400);
});

// Phase 4D: real PostgreSQL, authenticated API, media originals and concurrent jobs.
test('4D one active request per phone is atomic and defaults to sixty seconds', async()=>{
 const terminalId='4d-'+randomUUID(),deviceId=randomUUID();
 await api(`/stores/${store}/camera/devices/register`,'POST',{deviceId,name:'4D phone'},phoneAuth.accessToken);
 const pairing=await api(`/stores/${store}/camera/pairing`,'POST',{terminalId},ownerAuth.accessToken);
 assert.equal((await api(`/stores/${store}/camera/pair`,'POST',{code:pairing.data.code,deviceId},phoneAuth.accessToken)).status,201);
 const create=()=>api(`/stores/${store}/camera/jobs`,'POST',{terminalId,type:'product',label:'Multi photo',maxCaptures:12},ownerAuth.accessToken);
 const requests=await Promise.all([create(),create()]);assert.deepEqual(requests.map(r=>r.status).sort(),[201,409]);
 const job=requests.find(r=>r.status===201)!.data;assert.equal(job.maxCaptures,12);
 const seconds=(Date.parse(job.expiresAt)-Date.parse(job.createdAt))/1000;assert(seconds>=59&&seconds<=61);
 assert.equal((await api(`/stores/${store}/camera/devices/${pairing.data.id}/test`,'POST',{},ownerAuth.accessToken)).status,409);
 assert.equal((await api(`/stores/${store}/camera/test`,'POST',{},phoneAuth.accessToken)).status,409);
 await api(`/stores/${store}/camera/jobs/${job.id}`,'PATCH',{status:'cancelled'},ownerAuth.accessToken);
 const next=await create();assert.equal(next.status,201);
 await db.query("update app_private.camera_jobs set expires_at=now()-interval '1 second' where id=$1",[next.data.id]);
 assert.equal((await api(`/stores/${store}/camera/jobs/${next.data.id}`,'GET',undefined,ownerAuth.accessToken)).data.status,'expired');
 assert.equal((await create()).status,201);
});
test('4D crop derivatives retain the original, allow repeated edits and reject unauthorized edits', async()=>{
 const original=await sharp({create:{width:400,height:240,channels:3,background:'#e53935'}}).png().toBuffer(),entityId=randomUUID();
 const form=new FormData();form.set('kind','product');form.set('entityId',entityId);form.set('file',new Blob([original],{type:'image/png'}),'original.png');
 const uploaded=await fetch(url+`/api/v1/stores/${store}/media`,{method:'POST',headers:{Origin:origin,Authorization:'Bearer '+ownerAuth.accessToken},body:form});
 assert.equal(uploaded.status,201);const root=await uploaded.json() as any;
 const crop={x:0,y:0,width:.5,height:1,rotation:0};
 const first=await api(`/stores/${store}/media/crop`,'POST',{path:root.path,crop},ownerAuth.accessToken);assert.equal(first.status,201,JSON.stringify(first.data));assert.equal(first.data.width,200);assert.equal(first.data.height,240);
 const second=await api(`/stores/${store}/media/crop`,'POST',{path:first.data.path,crop:{x:0,y:0,width:1,height:1,rotation:90}},ownerAuth.accessToken);assert.equal(second.status,201);assert.equal(second.data.width,240);assert.equal(second.data.height,400);
 const ref=(await db.query('select original_media_id,crop from app_private.media where id=$1',[second.data.id])).rows[0];assert.equal(ref.original_media_id,root.id);
 const originalUrl=new URL(second.data.url,url);originalUrl.searchParams.set('original','1');const response=await fetch(url+originalUrl.pathname+originalUrl.search);assert.equal(response.status,200);assert.deepEqual(Buffer.from(await response.arrayBuffer()),original);
 assert.equal((await api(`/stores/${store}/media/crop`,'POST',{path:root.path,crop},employeeAuth.accessToken)).status,403);
 assert.equal((await api(`/stores/${store}/media/crop`,'POST',{path:root.path,crop:{...crop,x:1}},ownerAuth.accessToken)).status,400);
 assert.equal((await api(`/stores/${store}/media/${root.id}`,'DELETE',{},ownerAuth.accessToken)).status,400,'Originals in use must be retained');
 const rows=(await api(`/stores/${store}/media?entityType=product&entityId=${entityId}`,'GET',undefined,ownerAuth.accessToken)).data;assert.equal(rows.find((r:any)=>r.id===second.data.id).originalUrl,'taha-media:'+root.path);
});
test('4D dashboard groups ranges sensibly and refuses out-of-policy ranges',async()=>{
 for(const [from,to,count] of [['2026-10-07','2026-10-07',24],['2026-10-01','2026-10-07',7],['2025-01-01','2025-12-31',12]]){
  const r=await api(`/stores/${store}/dashboard/range?from=${from}&to=${to}`,'GET',undefined,ownerAuth.accessToken);assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.chart.length,count);assert(r.data.chart.every((p:any)=>Number.isFinite(p.sales)));
 }
 assert.equal((await api(`/stores/${store}/dashboard/range?from=2026-10-08&to=2026-10-07`,'GET',undefined,ownerAuth.accessToken)).status,422);
 const restricted=()=>api(`/stores/${store}/dashboard/range?from=2026-10-07&to=2026-10-07`,'GET',undefined,employeeAuth.accessToken);assert.equal((await restricted()).status,403);
 await db.query("insert into public.employee_permissions(profile_id,store_id,permission_id,enabled) select $1,$2,id,true from public.permissions where key='sales.view' on conflict do nothing",[employee,store]);const allowed=await restricted();assert.equal(allowed.status,200);assert.equal(allowed.data.profit,null);assert(allowed.data.chart.every((p:any)=>p.profit===null));
 await db.query("delete from public.employee_permissions where profile_id=$1 and permission_id in(select id from public.permissions where key='sales.view')",[employee]);
});

test('4D paired preview works independently of business storage and strips internal values',async()=>{
 const terminalId='preview-'+randomUUID(),deviceId=randomUUID();
 await api(`/stores/${store}/camera/terminals/register`,'POST',{terminalId,name:'Preview Counter'},ownerAuth.accessToken);
 await api(`/stores/${store}/camera/devices/register`,'POST',{deviceId,name:'Preview Phone'},phoneAuth.accessToken);
 const pair=await api(`/stores/${store}/camera/pairing`,'POST',{terminalId},ownerAuth.accessToken);
 await api(`/stores/${store}/camera/pair`,'POST',{code:pair.data.code,deviceId},phoneAuth.accessToken);
 const snapshot={mode:'CART_ACTIVE',terminalId,items:[{id:'visible',name:'Visible product',variant:'Black',quantity:1,unitPrice:500,purchaseCost:30,minimumSellingPrice:300,location:'Secret rack'}],subtotal:500,discount:0,total:500,profit:470};
 const rejected=await api(`/stores/${store}/displays/preview`,'PUT',{terminalId,snapshot},ownerAuth.accessToken);assert.equal(rejected.status,400);
 const safe={mode:'CART_ACTIVE',terminalId,items:[{id:'visible',name:'Visible product',variant:'Black',quantity:1,unitPrice:500}],subtotal:500,discount:0,total:500};const publish=await api(`/stores/${store}/displays/preview`,'PUT',{terminalId,snapshot:safe},ownerAuth.accessToken);assert.equal(publish.status,200,JSON.stringify(publish.data));
 const preview=await api(`/stores/${store}/displays/preview?terminalId=${terminalId}`,'GET',undefined,phoneAuth.accessToken);assert.equal(preview.status,200);assert.equal(preview.data.online,true);assert.equal(preview.data.snapshot.items[0].name,'Visible product');assert(!/purchaseCost|minimumSellingPrice|Secret rack|profit/.test(JSON.stringify(preview.data)));
 assert.equal((await api(`/stores/${store}/displays/preview?terminalId=other-counter`,'GET',undefined,phoneAuth.accessToken)).status,403);
 await api(`/stores/${store}/camera/devices/${pair.data.id}`,'DELETE',{},ownerAuth.accessToken);
 assert.equal((await api(`/stores/${store}/displays/preview?terminalId=${terminalId}`,'GET',undefined,phoneAuth.accessToken)).status,403);
});
test('4E product gallery, content, tax and safe receipts persist through the real API',async()=>{
 const id=randomUUID();const input={id,name:'Samsung A15 charging board',category:'Parts',brand:'Samsung',compatible_model:'A15',quality_grade:'Grade A',selling_price:100,minimum_selling_price:80,purchase_cost:30,initial_quantity:0,description_html:'<p><strong>Original</strong><script>alert(1)</script></p>',aliases:['charging patta'],tags:['Repair'],visibility:'store-and-website'};
 const image=await sharp({create:{width:300,height:180,channels:3,background:'#ffc107'}}).png().toBuffer();
 const uploadImage=async()=>{const form=new FormData();form.set('kind','product');form.set('entityId',id);form.set('staged','true');form.set('file',new Blob([image],{type:'image/png'}),'image.png');const res=await fetch(url+`/api/v1/stores/${store}/media`,{method:'POST',headers:{Origin:origin,Authorization:'Bearer '+ownerAuth.accessToken},body:form});assert.equal(res.status,201);return await res.json() as any;};
 const [a,b]=await Promise.all([uploadImage(),uploadImage()]);
 const save=await api(`/stores/${store}/products`,'POST',{...input,media_paths:[b.path,a.path]},ownerAuth.accessToken);assert.equal(save.status,201,JSON.stringify(save.data));assert.equal(save.data.primary_image_url,b.path);assert.match(save.data.description_html,/<strong>Original<\/strong>/);assert(!save.data.description_html.includes('script'));assert.deepEqual(save.data.tags,['Repair']);assert.equal(save.data.purchase_cost,undefined);
 const gallery=()=>api(`/stores/${store}/media?entityType=product&entityId=${id}`,'GET',undefined,ownerAuth.accessToken);assert.deepEqual((await gallery()).data.map((x:any)=>x.path),[b.path,a.path]);
 const failed=await api(`/stores/${store}/products`,'POST',{...input,expected_updated_at:'2000-01-01T00:00:00Z',media_paths:[a.path]},ownerAuth.accessToken);assert.equal(failed.status,409,JSON.stringify(failed.data));assert.deepEqual((await gallery()).data.map((x:any)=>x.path),[b.path,a.path]);
 const crop=await api(`/stores/${store}/media/crop`,'POST',{path:a.path,staged:true,crop:{x:0,y:0,width:.5,height:1,rotation:0}},ownerAuth.accessToken);assert.equal(crop.status,201,JSON.stringify(crop.data));assert.equal((await db.query('select original_media_id from app_private.media where id=$1',[crop.data.id])).rows[0].original_media_id,a.id);
 const edited=await api(`/stores/${store}/products`,'POST',{...input,expected_updated_at:save.data.updated_at,media_paths:[crop.data.path,b.path]},ownerAuth.accessToken);assert.equal(edited.status,201,JSON.stringify(edited.data));assert.equal(edited.data.primary_image_url,crop.data.path);
 const search=await api(`/stores/${store}/products/search?q=charging%20patta`,'GET',undefined,ownerAuth.accessToken);assert(search.data.some((row:any)=>row.id===id));assert(!JSON.stringify(search.data).includes('purchase_cost'));
 assert.equal((await api(`/stores/${store}/products`,'POST',{...input,id:randomUUID()},employeeAuth.accessToken)).status,403);
 assert.equal((await api(`/stores/${store}/products`,'POST',{...input,id:randomUUID(),supplier_id:randomUUID()},ownerAuth.accessToken)).status,422);
 const baseline=(await api(`/stores/${store}/settings`,'GET',undefined,ownerAuth.accessToken)).data,cash=(await api(`/stores/${store}/payment-methods`,'GET',undefined,ownerAuth.accessToken)).data.find((x:any)=>x.kind==='Cash').id;
 delete baseline.appearance;
 const profile={id:randomUUID(),name:'Configured Tax',rate:10,mode:'Exclusive',appliesTo:'Both',enabled:true};
 const profit=async()=>Number((await db.query("select private.period_profit($1,(now() at time zone 'Asia/Karachi')::date,(now() at time zone 'Asia/Karachi')::date) value",[store])).rows[0].value);
 const startingProfit=await profit();
 try{
  assert.equal((await api(`/stores/${store}/settings`,'PUT',{...baseline,taxProfiles:[profile],defaultTaxProfileId:profile.id},employeeAuth.accessToken)).status,403);
  assert.equal((await api(`/stores/${store}/settings`,'PUT',{...baseline,taxProfiles:[profile],defaultTaxProfileId:profile.id,showZeroTax:true},ownerAuth.accessToken)).status,200);
  const saleInput={idempotencyKey:randomUUID(),cartId:randomUUID(),lines:[{productId:'custom:'+randomUUID(),customService:{name:'Tax service',sellingPrice:100,minimumSellingPrice:100},quantity:1,unitPrice:100}],payments:[{methodId:cash,amount:110}],cashReceived:120};
  const sale=await api(`/stores/${store}/sales`,'POST',saleInput,ownerAuth.accessToken);assert.equal(sale.status,201,JSON.stringify(sale.data));assert.equal(sale.data.total,110);assert.equal(sale.data.tax.amount,10);assert.equal(sale.data.change,10);assert.equal(sale.data.lines[0].total,110);
  const item=(await db.query('select tax_amount from public.sale_items where sale_id=$1',[sale.data.id])).rows[0];assert.equal(Number(item.tax_amount),10);
  assert.equal(await profit(),startingProfit+100,'Collected tax is not gross profit');
  const token=new URL(sale.data.receiptUrl).pathname.replace('/api/v1','');assert.match(token,/^\/receipts\/[A-Za-z0-9_-]{43}$/,'Receipt links use an opaque compact capability');const safe=await api(token+'/data');assert.equal(safe.status,200,JSON.stringify(safe.data));assert.equal(safe.data.total,110);for(const key of ['purchase_cost','minimum','profit','proof','creditHistory','permissions'])assert(!JSON.stringify(safe.data).includes(key));assert.match((await api(token)).data,/TAHA MOBILES/);assert.equal((await api('/auth/session','GET',undefined,token.split('/').at(-1))).status,401);
  await api(`/stores/${store}/settings`,'PUT',{...baseline,taxProfiles:[{...profile,rate:20}],defaultTaxProfileId:profile.id},ownerAuth.accessToken);assert.equal((await api(`/stores/${store}/sales/${sale.data.id}`,'GET',undefined,ownerAuth.accessToken)).data.tax.rate,10);
  await api(`/stores/${store}/settings`,'PUT',{...baseline,taxProfiles:[{...profile,mode:'Inclusive'}],defaultTaxProfileId:profile.id},ownerAuth.accessToken);
  const included=await api(`/stores/${store}/sales`,'POST',{...saleInput,idempotencyKey:randomUUID(),cartId:randomUUID(),lines:[{productId:'custom:'+randomUUID(),customService:{name:'Included tax',sellingPrice:110,minimumSellingPrice:110},quantity:1,unitPrice:110}],cashReceived:110},ownerAuth.accessToken);assert.equal(included.status,201,JSON.stringify(included.data));assert.equal(included.data.total,110);assert.equal(included.data.tax.amount,10);assert.equal(included.data.tax.net,100);
  assert.equal(await profit(),startingProfit+200,'Inclusive tax is also excluded from profit');
  const refund=await api(`/stores/${store}/returns`,'POST',{idempotencyKey:randomUUID(),saleId:sale.data.id,productId:sale.data.lines[0].productId,quantity:1,reason:'Test taxed service refund',receiptConfirmed:true,destination:'Do Not Restore Stock',manualRefundConfirmed:true,refundMethodId:cash},ownerAuth.accessToken);assert.equal(refund.status,201,JSON.stringify(refund.data));assert.equal(refund.data.amount,110);const updatedReceipt=await api(token+'/data');assert.equal(updatedReceipt.data.paymentsReceived,110);assert.equal(updatedReceipt.data.refunded,110);assert.equal(updatedReceipt.data.paid,0);assert.equal(updatedReceipt.data.outstanding,0);assert.equal(await profit(),startingProfit+100,'The refunded tax does not count as a profit loss');
  const voided=await api(`/stores/${store}/sales/${included.data.id}/void`,'POST',{idempotencyKey:randomUUID(),reason:'Test inclusive-tax void',manualRefundConfirmed:true,refundMethodId:cash},ownerAuth.accessToken);assert.equal(voided.status,201,JSON.stringify(voided.data));assert.equal(await profit(),startingProfit);
 }finally{await api(`/stores/${store}/settings`,'PUT',{...baseline,taxProfiles:[],defaultTaxProfileId:''},ownerAuth.accessToken);}
});

