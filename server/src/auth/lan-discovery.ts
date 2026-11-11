import dgram from 'node:dgram';
import {isIPv4} from 'node:net';
import {networkInterfaces} from 'node:os';
import {createHash} from 'node:crypto';
const service='_taha-pos._tcp.local',group='224.0.0.251';
type Advertisement={address:string;port:number;name:string;host:string};
/** Honor an explicitly selected live adapter; stale DHCP addresses never win. */
export function selectLanAddress(available:string[],preferred?:string){
 const hosts=available.filter(address=>isIPv4(address)&&/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address));
 return preferred&&hosts.includes(preferred)?preferred:hosts[0]??'localhost';
}
function name(value:string){const labels=value.replace(/\.$/,'').split('.');if(labels.some(v=>!v||Buffer.byteLength(v)>63))throw new Error('Invalid DNS-SD name');return Buffer.concat([...labels.map(v=>Buffer.concat([Buffer.from([Buffer.byteLength(v)]),Buffer.from(v)])),Buffer.from([0])]);}
function record(owner:string,type:number,data:Buffer,ttl:number,unique=true){const header=Buffer.alloc(10);header.writeUInt16BE(type,0);header.writeUInt16BE(unique?0x8001:1,2);header.writeUInt32BE(ttl,4);header.writeUInt16BE(data.length,8);return Buffer.concat([name(owner),header,data]);}
/** Public reachability hints only. A discovered address never authorizes a session. */
export function discoveryPacket(ad:Advertisement,ttl=60){
 if(!isIPv4(ad.address)||ad.address==='0.0.0.0'||!Number.isInteger(ad.port)||ad.port<1||ad.port>65535)throw new Error('Invalid listener advertisement');
 const instance=ad.name+'.'+service,header=Buffer.alloc(12);header.writeUInt16BE(0x8400,2);header.writeUInt16BE(4,6);
 const srv=Buffer.alloc(6);srv.writeUInt16BE(ad.port,4);const text=Buffer.from('scheme=https;verify=pc-qr');
 return Buffer.concat([header,record(service,12,name(instance),ttl,false),record(instance,33,Buffer.concat([srv,name(ad.host)]),ttl),record(instance,16,Buffer.concat([Buffer.from([text.length]),text]),ttl),record(ad.host,1,Buffer.from(ad.address.split('.').map(Number)),ttl)]);
}
export function isTahaQuery(packet:Buffer){
 if(packet.length<12||packet.length>4096||(packet.readUInt16BE(2)&0x8000)||packet.readUInt16BE(4)>20)return false;
 try{let offset=12;for(let q=0;q<packet.readUInt16BE(4);q++){
  const labels:string[]=[];let pos=offset,end=0,steps=0;
  while(true){if(pos>=packet.length||++steps>64)throw new Error();const size=packet[pos++];if(size===0){if(!end)end=pos;break;}if((size&0xc0)===0xc0){if(pos>=packet.length)throw new Error();if(!end)end=pos+1;pos=((size&63)<<8)|packet[pos];continue;}if(size>63||pos+size>packet.length)throw new Error();labels.push(packet.subarray(pos,pos+size).toString('utf8'));pos+=size;}
  offset=end+4;if(offset>packet.length)throw new Error();const queried=labels.join('.').toLowerCase();if(queried===service||queried.endsWith('.'+service)||queried==='_services._dns-sd._udp.local'||queried.startsWith('taha-')&&queried.endsWith('.local'))return true;
 }return false;}catch{return false;}
}
export function advertiseLanListener(origin:string){
 const url=new URL(origin);if(url.protocol!=='https:'||!isIPv4(url.hostname))return ()=>{};
 const address=url.hostname,port=Number(url.port||443),suffix=createHash('sha256').update(origin).digest('hex').slice(0,8);
 const ad={address,port,name:(process.env.TAHA_LAN_COUNTER_NAME??'Taha Mobiles Main Counter').replace(/[.]/g,' ').slice(0,40)+' '+suffix,host:'taha-'+suffix+'.local'};
 const socket=dgram.createSocket({type:'udp4',reuseAddr:true});let ready=false,closed=false,lastAnswer=0;
 const send=(ttl=60)=>{if(!ready||closed)return;socket.send(discoveryPacket(ad,ttl),5353,group,error=>{if(error)console.warn('Local discovery announcement unavailable: '+(error as NodeJS.ErrnoException).code);});};
 socket.on('error',error=>console.warn('Local discovery unavailable; QR/manual connection remains available: '+error.message));
 socket.on('message',message=>{if(isTahaQuery(message)&&Date.now()-lastAnswer>1000){lastAnswer=Date.now();send();}});
 socket.bind(5353,()=>{ready=true;socket.setMulticastTTL(255);for(const addresses of Object.values(networkInterfaces()))for(const item of addresses??[])if(item.family==='IPv4'&&!item.internal){try{socket.addMembership(group,item.address);}catch{/* QR/manual remains available on interfaces blocking multicast. */}}send();});
 socket.unref();const timer=setInterval(()=>send(),30000);timer.unref();
 return ()=>{if(closed)return;send(0);clearInterval(timer);closed=true;try{socket.close();}catch{/* A failed bind already closed the socket. */}};
}
