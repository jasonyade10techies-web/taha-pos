import {readFile,access} from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import express from 'express';
import type {NestExpressApplication} from '@nestjs/platform-express';
import type {Configuration} from './config';

export async function installFrontend(app:NestExpressApplication,config:Configuration){
 const releaseModule=createRequire(__filename)(path.resolve(__dirname,'../distribution/handler.mjs')) as {createDownloadHandler:(root:string)=>(request:express.Request,response:express.Response)=>Promise<boolean>};
 const downloads=releaseModule.createDownloadHandler(process.env.TAHA_RELEASE_ROOT??path.resolve(__dirname,'../android-releases'));
 app.use((request:express.Request,response:express.Response,next:express.NextFunction)=>{void downloads(request,response).then(handled=>{if(!handled)next();}).catch(()=>{if(!response.headersSent)response.status(503).json({message:'Downloads temporarily unavailable.'});else response.end();});});
 if(!config.serveFrontend)return;
 const root=config.frontendRoot,index=path.join(root,'index.html');await access(index);
 const metadata=JSON.parse(await readFile(path.join(root,'deployment.json'),'utf8')) as Record<string,unknown>;
 if(metadata.dataProvider!=='api'||metadata.mockAuthentication!==false||metadata.apiBase!=='/api/v1')throw Error('The bundled browser release must use the real same-origin API.');
 const serve=express.static(root,{index:false,redirect:false,dotfiles:'deny',fallthrough:true,setHeaders:response=>response.setHeader('Cache-Control','public, max-age=3600')});
 app.use((request:express.Request,response:express.Response,next:express.NextFunction)=>{
  if(/^\/api(?:\/|$)/i.test(request.path))return next();
  let decoded:string;try{decoded=decodeURIComponent(request.path);}catch{return response.status(400).json({message:'Invalid address.'});}
  if(decoded.split('/').some(part=>part.startsWith('.')))return response.status(404).json({message:'Not found.'});
  return serve(request,response,next);
 });
 app.use((request:express.Request,response:express.Response,next:express.NextFunction)=>{
  if(/^\/api(?:\/|$)/i.test(request.path)||!['GET','HEAD'].includes(request.method))return next();
  if(path.posix.extname(request.path)||!request.accepts('html'))return response.status(404).json({message:'Not found.'});
  response.setHeader('Cache-Control','private, no-store, max-age=0');return response.sendFile('index.html',{root});
 });
}
