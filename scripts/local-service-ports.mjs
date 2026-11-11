import net from 'node:net';
export const portListening=port=>new Promise(resolve=>{const socket=net.connect({host:'127.0.0.1',port});socket.once('connect',()=>{socket.destroy();resolve(true);});socket.once('error',()=>resolve(false));socket.setTimeout(1000,()=>{socket.destroy();resolve(false);});});
export async function tahaApiHealthy(port){try{const response=await fetch(`http://127.0.0.1:${port}/api/v1/health`,{signal:AbortSignal.timeout(1500)});if(!response.ok)return false;const body=await response.json();return body.application==='taha-pos'&&body.status==='ok'&&body.database==='connected';}catch{return false;}}
export async function selectLocalApiPort(ports=[3001,3003,3004,3005]){
 for(const port of ports)if(await tahaApiHealthy(port))return {port,reuse:true};
 for(const port of ports)if(!await portListening(port))return {port,reuse:false};
 throw new Error('The development API ports are occupied. Existing services were not stopped.');
}
