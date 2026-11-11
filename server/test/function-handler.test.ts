import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createFunctionHandler} from '../src/function-handler';

test('concurrent function requests initialize once without opening a listener',async()=>{
 let initialized=0,handled=0;let release!:()=>void;
 const ready=new Promise<void>(resolve=>{release=resolve;});
 const handler=createFunctionHandler(async()=>{initialized++;await ready;return (_req:unknown,_res:unknown)=>{handled++;};});
 const a=handler({},{}),b=handler({},{});assert.equal(initialized,1);release();await Promise.all([a,b]);await handler({},{});assert.equal(initialized,1);assert.equal(handled,3);
});
test('a failed cold initialization returns a sanitized503 and can recover next request',async()=>{
 let attempts=0;const responses:{status?:number;body?:string}[]=[];
 const handler=createFunctionHandler(async()=>{if(++attempts===1)throw new Error('postgresql://secret-must-never-leak');return (_req:unknown,_res:unknown)=>{};});
 const response={statusCode:0,setHeader(){},end(body:string){responses.push({status:this.statusCode,body});}};
 await handler({},response);assert.equal(responses[0].status,503);assert.ok(!responses[0].body?.includes('secret'));assert.match(responses[0].body??'',/temporarily unavailable/i);await handler({},{});assert.equal(attempts,2);
});
