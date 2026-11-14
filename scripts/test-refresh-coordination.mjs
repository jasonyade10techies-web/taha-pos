// Local-only browser regression. Requires the existing isolated acceptance launcher.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createServer,request} from 'node:http';
import {createHash} from 'node:crypto';
import path from 'node:path';
import pg from 'pg';
import {chromium,expect} from '@playwright/test';
const root=process.cwd(),evidence=path.join(root,'.test-postgres','refresh-coordination',String(Date.now()));mkdirSync(evidence,{recursive:true});console.log('Evidence: '+evidence);
const fixture=JSON.parse(readFileSync(process.env.TAHA_LOCAL_ACCEPTANCE_STATUS??path.join(root,'.test-postgres','release-readiness-20261114','local','processes.json'),'utf8'));
assert.equal(fixture.ready,true);assert.equal(fixture.postgres.port,55459);assert.match(fixture.postgres.database,/^taha_api_browser_\d+$/);
const db=new pg.Client({connectionString:'postgresql://taha_phase5c@127.0.0.1:55459/'+fixture.postgres.database});
let browser,proxy;const rotations=[];let delaying=true,observeRefresh=()=>{};const lifecycle={};
try{
 await db.connect();assert.match((await db.query("select current_setting('data_directory') directory")).rows[0].directory.replaceAll('\\','/'),/\.test-postgres\/phase5c-20261014\/pgdata$/);
 proxy=createServer((req,res)=>{
  const upstream=request('http://127.0.0.1:1423'+req.url,{method:req.method,headers:{...req.headers,host:'127.0.0.1:1423',...(req.headers.origin?{origin:'http://127.0.0.1:1423'}:{})}},reply=>{
   if(req.url==='/api/v1/auth/refresh'&&delaying){const parts=[];reply.on('data',part=>parts.push(part));reply.on('end',()=>{rotations.push({status:reply.statusCode,cookieDigest:createHash('sha256').update(req.headers.cookie??'').digest('hex')});observeRefresh();setTimeout(()=>{if(!res.destroyed){res.writeHead(reply.statusCode,reply.headers);res.end(Buffer.concat(parts));}},1000);});}
   else{res.writeHead(reply.statusCode,reply.headers);reply.pipe(res);}
  });upstream.on('error',()=>{if(!res.headersSent)res.writeHead(503);res.end();});req.pipe(upstream);
 });await new Promise(resolve=>proxy.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+proxy.address().port;
 browser=await chromium.launch();const context=await browser.newContext();
 const login=await context.request.post(origin+'/api/v1/auth/login',{headers:{Origin:origin},data:{email:'owner@taha.test',password:'Secure test password 2026!'}});assert.equal(login.status(),201);
 const before=Number((await db.query("select count(*) n from public.audit_logs where action='auth.refresh_replayed'")).rows[0].n);
 const pages=await Promise.all([context.newPage(),context.newPage()]);await Promise.all(pages.map(page=>page.goto(origin+'/dashboard')));
 for(const page of pages)await expect(page.getByRole('heading',{name:'Dashboard',exact:true})).toBeVisible({timeout:25000});
 const after=Number((await db.query("select count(*) n from public.audit_logs where action='auth.refresh_replayed'")).rows[0].n);
 const result={at:new Date().toISOString(),case:'Two tabs restore the same cookie concurrently; the first real upstream response is delayed one second.',rotations:rotations.map(r=>({status:r.status})),distinctPresentedCookies:new Set(rotations.map(r=>r.cookieDigest)).size,replayAuditDelta:after-before};
 writeFileSync(path.join(evidence,'concurrent.json'),JSON.stringify(result,null,2));assert.deepEqual(rotations.map(r=>r.status),[201,201]);assert.equal(after,before);assert.equal(result.distinctPresentedCookies,2);console.log('PASS concurrent real browser restoration; both sessions stay authenticated and replay enforcement remains active.');
 if(process.argv.includes('--reload')){
  const interrupted=await browser.newContext();const signedIn=await interrupted.request.post(origin+'/api/v1/auth/login',{headers:{Origin:origin},data:{email:'owner@taha.test',password:'Secure test password 2026!'}});assert.equal(signedIn.status(),201);
  const view=await interrupted.newPage();view.on('requestfailed',request=>{if(request.url().endsWith('/auth/refresh'))lifecycle.failed=request.failure()?.errorText;});let committed;const acknowledgement=new Promise(resolve=>committed=resolve);observeRefresh=()=>committed();const start=rotations.length;
  await view.goto(origin+'/dashboard');await acknowledgement;observeRefresh=()=>{};lifecycle.before=await view.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([key])=>key.startsWith('taha-auth:')).map(([key,value])=>[key,{remaining:JSON.parse(value).until-Date.now()}])));await view.reload();lifecycle.after=await view.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([key])=>key.startsWith('taha-auth:')).map(([key,value])=>[key,{remaining:JSON.parse(value).until-Date.now()}])));await expect(view.getByRole('heading',{name:'Dashboard',exact:true})).toBeVisible({timeout:25000});
  writeFileSync(path.join(evidence,'reload.json'),JSON.stringify({at:new Date().toISOString(),case:'Reload after upstream rotation committed but before its response headers reached the browser.',statuses:rotations.slice(start).map(r=>r.status)},null,2));console.log('PASS interrupted restoration reload.');await interrupted.close();
 }
 const replay=await browser.newContext();const signedIn=await replay.request.post(origin+'/api/v1/auth/login',{headers:{Origin:origin},data:{email:'owner@taha.test',password:'Secure test password 2026!'}});assert.equal(signedIn.status(),201);
 const oldCookie=(await replay.cookies()).find(cookie=>cookie.name==='taha_refresh');assert(oldCookie);const rotated=await replay.request.post(origin+'/api/v1/auth/refresh',{headers:{Origin:origin}});assert.equal(rotated.status(),201);const rotatedBody=await rotated.json();
 const rejected=await fetch('http://127.0.0.1:3306/api/v1/auth/refresh',{method:'POST',headers:{Origin:'http://127.0.0.1:1423',Cookie:'taha_refresh='+oldCookie.value}});assert.equal(rejected.status,401);
 assert.equal((await fetch('http://127.0.0.1:3306/api/v1/auth/session',{headers:{Authorization:'Bearer '+rotatedBody.accessToken}})).status,401);await replay.close();
 writeFileSync(path.join(evidence,'replay.json'),JSON.stringify({at:new Date().toISOString(),replayStatus:401,revokedSessionStatus:401},null,2));console.log('PASS stolen/replayed old refresh remains rejected and revokes its session.');
}catch(error){writeFileSync(path.join(evidence,'failure.json'),JSON.stringify({at:new Date().toISOString(),message:error.message,rotationStatuses:rotations.map(r=>r.status),lifecycle},null,2));console.error(error.message);process.exitCode=1;}
finally{delaying=false;await browser?.close();if(proxy){proxy.closeAllConnections();await new Promise(resolve=>proxy.close(resolve));}await db.end();}
