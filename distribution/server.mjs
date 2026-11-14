import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createDownloadHandler} from './handler.mjs';
const root=process.env.TAHA_RELEASE_ROOT||path.dirname(fileURLToPath(import.meta.url));
const handle=createDownloadHandler(root);
const server=createServer(async(req,res)=>{try{if(req.url==='/'){res.writeHead(302,{Location:'/downloads/taha-staff'});res.end();}else if(!await handle(req,res)){res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');}}catch{if(!res.headersSent)res.writeHead(503);res.end('Downloads temporarily unavailable');}});
server.listen(Number(process.env.PORT||4180),process.env.HOST||'0.0.0.0',()=>console.log('Taha Staff downloads listening.'));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>process.exit(0)));
