import 'reflect-metadata';
import {NestFactory} from '@nestjs/core';
import {DocumentBuilder,SwaggerModule} from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import {AppModule} from './app.module';
import {CONFIG,type Configuration} from './config';
import {SafeErrors} from './errors';
import {createServer} from 'node:https';
import {readFileSync} from 'node:fs';
import type {INestApplication} from '@nestjs/common';
import type {NestExpressApplication} from '@nestjs/platform-express';
import {advertiseLanListener} from './auth/lan-discovery';
import {installFrontend} from './frontend';
export async function startLanTls(app:INestApplication){
 if(app.get<Configuration>(CONFIG).cloud)return null;
 if(!process.env.TAHA_LAN_TLS_CERT&&!process.env.TAHA_LAN_TLS_KEY)return null;
 const port=Number(process.env.TAHA_LAN_TLS_PORT??3443);
 if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid TAHA_LAN_TLS_PORT.');
 const server=createServer({cert:readFileSync(process.env.TAHA_LAN_TLS_CERT!),key:readFileSync(process.env.TAHA_LAN_TLS_KEY!),minVersion:'TLSv1.2'},app.getHttpAdapter().getInstance());
 await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(port,'0.0.0.0',resolve);});
 const stopDiscovery=process.env.TAHA_LAN_TLS_ORIGIN?advertiseLanListener(process.env.TAHA_LAN_TLS_ORIGIN):()=>{};server.once('close',stopDiscovery);
 process.once('SIGTERM',()=>server.close());process.once('SIGINT',()=>server.close());return server;
}
export async function createApp(){
 const app=await NestFactory.create<NestExpressApplication>(AppModule.register(),{logger:process.env.NODE_ENV==='production'?['error','warn']:['error','warn','log']});const config=app.get<Configuration>(CONFIG);
 app.set('trust proxy',config.trustedProxy||false);
 const storageOrigin=config.s3Endpoint?new URL(config.s3Endpoint).origin:config.storageDriver==='s3'?`https://${config.s3Bucket}.s3.${config.s3Region}.amazonaws.com`:null;
 app.setGlobalPrefix('api/v1');app.use(helmet(config.serveFrontend?{contentSecurityPolicy:{directives:{scriptSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'"],imgSrc:["'self'",'data:','blob:'],fontSrc:["'self'"],connectSrc:["'self'",...(storageOrigin?[storageOrigin]:[])],frameSrc:["'self'",'blob:'],objectSrc:["'none'"]}}}:undefined));app.use(cookieParser());app.useGlobalFilters(new SafeErrors());
 app.use((_req:unknown,res:{setHeader:(key:string,value:string)=>void},next:()=>void)=>{res.setHeader('Cache-Control','private, no-store, max-age=0');res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');next();});
 app.enableCors({origin:config.origins,credentials:true,allowedHeaders:['Content-Type','Authorization','X-Counter-Session']});
 await installFrontend(app,config);
 if(!config.production){const doc=SwaggerModule.createDocument(app,new DocumentBuilder().setTitle('TAHA MOBILES API').setVersion('1.0').addBearerAuth().build());SwaggerModule.setup('api/docs',app,doc);}
 app.enableShutdownHooks();return app;
}
if(require.main===module)createApp().then(async app=>{const config=app.get<Configuration>(CONFIG);await app.listen(config.port,config.bindHost);await startLanTls(app);}).catch(()=>{console.error('Taha POS could not start. Review the required backend configuration and private runtime diagnostics.');process.exitCode=1;});
