// Read-only probe. Supply an approved HTTPS origin; no credentials in arguments.
const base=new URL(process.argv[2]??'');
if(base.protocol!=='https:'||base.username||base.password||base.pathname!=='/'||base.search||base.hash)throw Error('Supply the approved HTTPS origin only.');
const checks=[];
for(const route of ['/api/v1/health/live','/api/v1/health/readyz','/login','/products/nested-refresh','/api/v1/no-such-route','/assets/no-such-file.js']){
 const response=await fetch(new URL(route,base),{signal:AbortSignal.timeout(15000),redirect:'error',headers:{Accept:'text/html'}}),expected=route.includes('no-such')?404:200;
 checks.push({route,status:response.status,pass:response.status===expected});
}
if(process.env.TAHA_SMOKE_ACCESS_TOKEN){const response=await fetch(new URL('/api/v1/health/ready?refresh=1',base),{headers:{Authorization:'Bearer '+process.env.TAHA_SMOKE_ACCESS_TOKEN},signal:AbortSignal.timeout(30000)});const value=await response.json();checks.push({route:'authorized deep readiness',status:response.status,pass:response.ok&&value.status==='ready'});}
console.log(JSON.stringify({checks},null,2));if(checks.some(check=>!check.pass))process.exitCode=1;
