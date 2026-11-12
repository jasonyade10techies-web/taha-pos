import 'dotenv/config';
import path from 'node:path';
import {isIP} from 'node:net';
function privateHost(host:string){return host==='localhost'||host==='[::1]'||host.endsWith('.localhost')||host.endsWith('.local')||/^(127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);}
function cloudOrigin(input:string,label:string){let u:URL;try{u=new URL(input);}catch{throw new Error(label+' must be an explicit HTTPS origin.');}if(u.protocol!=='https:'||privateHost(u.hostname)||u.username||u.password||u.search||u.hash||u.pathname!=='/')throw new Error(label+' must be a public HTTPS origin.');}
export function configuration() {
  const databaseUrl=process.env.DATABASE_URL;
  const secret=process.env.JWT_SECRET;
  if(!databaseUrl) throw new Error('DATABASE_URL is required.');
  let databaseAddress:URL;try{databaseAddress=new URL(databaseUrl);}catch{throw new Error('DATABASE_URL must be a valid PostgreSQL connection.');}
  if(!['postgres:','postgresql:'].includes(databaseAddress.protocol))throw new Error('DATABASE_URL must use PostgreSQL.');
  if(!secret || Buffer.byteLength(secret)<32) throw new Error('JWT_SECRET must contain at least 32 random bytes.');
  const production=process.env.NODE_ENV==='production';
  const cloud=process.env.VERCEL==='1'||process.env.TAHA_RUNTIME==='cloud';
  if(process.env.TAHA_RUNTIME&&!['local','cloud'].includes(process.env.TAHA_RUNTIME))throw new Error('TAHA_RUNTIME must be local or cloud.');
  const port=Number(process.env.PORT??3000);
  if(!Number.isInteger(port)||port<(production?1:0)||port>65535)throw new Error('PORT must be a valid platform-assigned port.');
  const proxy=process.env.TAHA_TRUST_PROXY?.trim();
  if(proxy&&proxy!=='loopback'&&proxy.split(',').some(value=>{const [host,bits]=value.trim().split('/');const version=isIP(host);return !version||bits!==undefined&&(!/^\d+$/.test(bits)||Number(bits)<1||Number(bits)>(version===4?32:128));}))throw new Error('TAHA_TRUST_PROXY must name loopback or explicit trusted proxy addresses/CIDRs, never trust all.');
  const deploymentEnv=process.env.TAHA_DEPLOYMENT_ENV??(production?'production':'development');
  if(!['development','staging','production'].includes(deploymentEnv))throw new Error('Invalid TAHA_DEPLOYMENT_ENV.');
  const databasePoolMax=Number(process.env.DATABASE_POOL_MAX??(cloud?2:10));
  if(!Number.isInteger(databasePoolMax)||databasePoolMax<1||databasePoolMax>(cloud?5:30))throw new Error('Database pool size must be bounded (cloud maximum5).');
  if(cloud){
   if(!production||deploymentEnv==='development')throw new Error('Cloud runtime requires an explicit staging/production environment and NODE_ENV=production.');
   let db:URL;try{db=new URL(databaseUrl);}catch{throw new Error('Invalid cloud database configuration.');}
   if(!['postgres:','postgresql:'].includes(db.protocol)||privateHost(db.hostname)||['disable','no-verify','allow','prefer'].includes(db.searchParams.get('sslmode')??''))throw new Error('Cloud PostgreSQL requires a public endpoint with verified TLS.');
   if(process.env.STORAGE_DRIVER!=='s3'||!process.env.S3_BUCKET||!process.env.S3_ACCESS_KEY_ID||!process.env.S3_SECRET_ACCESS_KEY)throw new Error('Cloud private object storage configuration is incomplete; local disk is not durable.');
   if(process.env.S3_ENDPOINT)cloudOrigin(process.env.S3_ENDPOINT,'S3_ENDPOINT');
   if(!process.env.FRONTEND_ORIGIN||!process.env.PUBLIC_API_URL)throw new Error('Cloud FRONTEND_ORIGIN and PUBLIC_API_URL are required.');
   process.env.FRONTEND_ORIGIN.split(',').forEach(origin=>cloudOrigin(origin.trim(),'FRONTEND_ORIGIN'));
   cloudOrigin(process.env.PUBLIC_API_URL,'PUBLIC_API_URL');
  }
  const origins=(process.env.FRONTEND_ORIGIN??'http://localhost:5173').split(',').map(x=>x.trim());
  if(production && origins.some(x=>!x.startsWith('https://'))) throw new Error('Production FRONTEND_ORIGIN must use HTTPS.');
  // A fixed packaged desktop origin is separate from public browser origins.
  origins.push('tauri://localhost','http://tauri.localhost');
  const mobileOrigin=process.env.MOBILE_APP_ORIGIN;
  if(mobileOrigin){if(mobileOrigin!=='http://localhost')throw new Error('MOBILE_APP_ORIGIN must match the fixed bundled Android origin http://localhost.');origins.push(mobileOrigin);}
  const publicUrl=process.env.PUBLIC_API_URL??(production?'':'http://localhost:3000');
  if(!publicUrl)throw new Error('PUBLIC_API_URL is required in production.');
  let api:URL;try{api=new URL(publicUrl);}catch{throw new Error('PUBLIC_API_URL must be a valid API origin.');}
  if(production&&api.protocol!=='https:')throw new Error('Production PUBLIC_API_URL must use HTTPS.');
  if(api.username||api.password||api.search||api.hash||api.pathname!=='/'||!['https:','http:'].includes(api.protocol))throw new Error('PUBLIC_API_URL must be an HTTP(S) origin without credentials or a path.');
  const serveFrontend=process.env.TAHA_SERVE_FRONTEND==='true';
  if(serveFrontend&&!origins.includes(api.origin))throw new Error('The bundled browser frontend and PUBLIC_API_URL must share an allowed origin.');
  const bindHost=process.env.TAHA_BIND_HOST??'0.0.0.0';
  if(!['0.0.0.0','127.0.0.1','::'].includes(bindHost))throw new Error('TAHA_BIND_HOST must be a supported listener address.');
  return {databaseUrl,secret,production,cloud,deploymentEnv,databasePoolMax,origins,port,bindHost,serveFrontend,
    frontendRoot:path.resolve(process.env.TAHA_FRONTEND_ROOT??path.join(__dirname,'../public')),
    trustedProxy:cloud&&proxy?(proxy==='loopback'?'loopback':proxy.split(',').map(value=>value.trim())):false,
    publicUrl:api.origin,
    cookieSecure:production || process.env.COOKIE_SECURE==='true',storageRoot:process.env.STORAGE_ROOT??'./data/media',
    storageDriver:process.env.STORAGE_DRIVER??'local',s3Bucket:process.env.S3_BUCKET,s3Region:process.env.S3_REGION??'auto',s3Endpoint:process.env.S3_ENDPOINT,s3AccessKey:process.env.S3_ACCESS_KEY_ID,s3SecretKey:process.env.S3_SECRET_ACCESS_KEY};
}
export type Configuration=ReturnType<typeof configuration>;
export const CONFIG=Symbol('CONFIG');
