import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {parse} from 'dotenv';
import {networkInterfaces} from 'node:os';
import pg from 'pg';
import {prepareLocalMedia} from './prepare-local-media';
import {selectLanAddress} from '../src/auth/lan-discovery';

async function run(){
 const port=Number(process.env.TAHA_LOCAL_API_PORT??3001);if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid local API port.');
 const env=parse(await readFile(path.resolve(__dirname,'../.env.mobile-test')));
 const db=new URL(env.DATABASE_URL??'');
 if(!['localhost','127.0.0.1'].includes(db.hostname)||db.port!=='55439'||!/^taha_api_browser_\d+$/.test(db.pathname.slice(1)))throw new Error('The saved local development database is required; production connections are not accepted.');
 Object.assign(process.env,env,{NODE_ENV:'development',PORT:String(port),MOBILE_APP_ORIGIN:'http://localhost'});
 process.env.STORAGE_ROOT=await prepareLocalMedia(env.STORAGE_ROOT??path.resolve(__dirname,'../data/media'));
 const interfaces=Object.entries(networkInterfaces()).filter(([name])=>!/vEthernet|virtual|vmware|vpn|wireguard|tailscale|zerotier/i.test(name));
 interfaces.sort(([a],[b])=>Number(!/^(Ethernet|Wi-Fi|WLAN)/i.test(a))-Number(!/^(Ethernet|Wi-Fi|WLAN)/i.test(b)));
 const hosts=interfaces.flatMap(([,addresses])=>addresses??[]).filter(v=>v.family==='IPv4'&&!v.internal&&/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(v.address)).map(v=>v.address);
 const lan=hosts.map(host=>`http://${host}:1423`);
 let selectedHost=selectLanAddress(hosts);
 // Persisted TLS setup survives the standard launcher and follows router/hotspot
 // address changes without copying credentials into configuration or APK assets.
 const tlsFolder=path.resolve(__dirname,'../data/lan-tls');
 try{const saved=JSON.parse((await readFile(path.join(tlsFolder,'runtime.json'),'utf8')).replace(/^\uFEFF/,''));if(saved.version!==1||!Number.isInteger(saved.port)||saved.port<1024||saved.port>65535)throw new Error('Invalid saved local TLS configuration.');
  selectedHost=selectLanAddress(hosts,saved.preferredAddress);
  process.env.TAHA_LAN_TLS_CERT=path.join(tlsFolder,'counter-cert.pem');process.env.TAHA_LAN_TLS_KEY=path.join(tlsFolder,'counter-key.pem');process.env.TAHA_LAN_TLS_PORT=String(saved.port);process.env.TAHA_LAN_TLS_ORIGIN=`https://${selectedHost}:${saved.port}`;
 }catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 // The phone must receive a reachable shop origin, never the counter's localhost.
 process.env.PUBLIC_API_URL=`http://${selectedHost}:${port}`;
 process.env.FRONTEND_ORIGIN=['http://localhost:1423','http://127.0.0.1:1423',...lan].join(',');
 const deadline=Date.now()+600000;let ready=false;
 while(!ready&&Date.now()<deadline){const client=new pg.Client({connectionString:env.DATABASE_URL,connectionTimeoutMillis:1000});try{await client.connect();await client.query('select 1');ready=true;}catch{await new Promise(resolve=>setTimeout(resolve,2000));}finally{await client.end().catch(()=>undefined);}}
 if(!ready)throw new Error('The local database is still unavailable. Restart local acceptance after recovery finishes; no data was reset.');
 const {createApp,startLanTls}=await import('../src/main');const app=await createApp();await app.listen(port,'0.0.0.0');await startLanTls(app);
 console.log(`Local acceptance backend ready on port ${port}. Existing development accounts/data retained.`);
 console.log('Local shop address: '+process.env.PUBLIC_API_URL);
 console.log(process.env.TAHA_LAN_TLS_ORIGIN?'Protected phone connection: '+process.env.TAHA_LAN_TLS_ORIGIN:'Passwordless phone connection disabled: run scripts/configure-lan-tls.ps1 first.');
}
run().catch(e=>{console.error(e instanceof Error?e.message:'Local backend could not start.');process.exitCode=1;});
