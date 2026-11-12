import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRevisionPoller,type RevisionPage,type RevisionPollOptions,type PollStatus} from '../../src/lib/api/revision-poller';
const flush=()=>new Promise<void>(resolve=>setImmediate(resolve));
const page=(cursor='1',extra:Partial<RevisionPage>={}):RevisionPage=>({cursor,hasMore:false,changes:[],...extra});
const deferred=<T>()=>{let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return{promise,resolve};};
function harness(overrides:Partial<RevisionPollOptions>={}){
 let sequence=0;const timers=new Map<number,{callback:()=>void;delay:number}>(),states:PollStatus[]=[],saved:string[]=[],applied:RevisionPage[]=[],fetches:{cursor:string;bootstrap:boolean;signal:AbortSignal}[]=[];
 const options:RevisionPollOptions={fetchPage:async(cursor,signal,bootstrap)=>{fetches.push({cursor,signal,bootstrap});return page();},apply:async value=>{applied.push(value);},saveCursor:async value=>{saved.push(value);},state:value=>states.push(value),schedule:(callback,delay)=>{const id=++sequence;timers.set(id,{callback,delay});return id;},cancel:timer=>{assert.equal(typeof timer,'number');timers.delete(timer as number);},...overrides};
 const poller=createRevisionPoller(options);
 const fire=async()=>{const entry=timers.entries().next().value;assert(entry,'A poll must be scheduled');timers.delete(entry[0]);entry[1].callback();await flush();};
 return{poller,timers,states,saved,applied,fetches,fire};
}
test('poll bootstrap persists only after apply and unchanged polls do not rewrite SQLite cursor',async()=>{
 const order:string[]=[];let calls=0;
 const h=harness({fetchPage:async()=>page('7',calls++===0?{resetRequired:true}:{}),apply:async()=>{order.push('apply');},saveCursor:async()=>{order.push('save');},committed:()=>{order.push('committed');}});
 h.poller.start();await flush();assert.deepEqual(order,['apply','save','committed']);assert.equal([...h.timers.values()][0].delay,4000);
 await h.fire();assert.deepEqual(order,['apply','save','committed','committed']);h.poller.stop();assert.equal(h.timers.size,0);
});
test('busy kicks coalesce, drain missed pages and never overlap requests',async()=>{
 const response=deferred<RevisionPage>();let requests=0;const h=harness({fetchPage:async()=>{requests++;return response.promise;}});
 h.poller.start();await flush();h.poller.kick();h.poller.kick();assert.equal(requests,1);response.resolve(page('200',{hasMore:true}));await flush();assert.equal([...h.timers.values()][0].delay,100);h.poller.stop();
});
test('outage backs off, preserves cursor, and successful reconnect resumes from the last acknowledgement',async()=>{
 let fail=true;const seen:string[]=[];const h=harness({loadCursor:async()=>'9',fetchPage:async cursor=>{seen.push(cursor);if(fail)throw Error('offline');return page('10');}});
 h.poller.start();await flush();assert.equal([...h.timers.values()][0].delay,2000);await h.fire();assert.equal([...h.timers.values()][0].delay,4000);assert.deepEqual(h.saved,[]);
 fail=false;h.poller.kick();await flush();assert.deepEqual(seen,['9','9','9']);assert.deepEqual(h.saved,['10']);assert.equal(h.states.at(-1),'connected');h.poller.stop();
});
test('apply failures do not acknowledge or lose a committed revision',async()=>{
 let fail=true;const seen:string[]=[];const h=harness({loadCursor:async()=>'3',fetchPage:async cursor=>{seen.push(cursor);return page('4',{changes:[{id:'one',resource:'jobs',revision:'4'}]});},apply:async()=>{if(fail)throw Error('cache write failed');}});
 h.poller.start();await flush();assert.deepEqual(h.saved,[]);fail=false;await h.fire();assert.deepEqual(seen,['3','3']);assert.deepEqual(h.saved,['4']);h.poller.stop();
});
test('unsubscribe aborts and ignores an already pending response',async()=>{
 const response=deferred<RevisionPage>();let signal:AbortSignal|undefined;const h=harness({fetchPage:async(_cursor,s)=>{signal=s;return response.promise;}});
 h.poller.start();await flush();h.poller.stop();assert.equal(signal?.aborted,true);response.resolve(page('1',{resetRequired:true}));await flush();assert.deepEqual(h.applied,[]);assert.deepEqual(h.saved,[]);assert.equal(h.timers.size,0);
});
test('pause/resume discards the pre-sleep response and schedules only one fresh poll',async()=>{
 const response=deferred<RevisionPage>();const h=harness({fetchPage:async()=>response.promise});h.poller.start();await flush();h.poller.pause();h.poller.resume();response.resolve(page('1',{resetRequired:true}));await flush();assert.deepEqual(h.applied,[]);assert.deepEqual(h.saved,[]);assert.equal(h.timers.size,1);await h.fire();assert.equal(h.applied.length,1);h.poller.stop();
});
test('old account generation can never publish into the next session',async()=>{
 let epoch=0;const response=deferred<RevisionPage>();const h=harness({epoch:()=>epoch,fetchPage:async()=>response.promise});h.poller.start();await flush();epoch++;response.resolve(page('1',{resetRequired:true}));await flush();assert.deepEqual(h.applied,[]);assert.deepEqual(h.saved,[]);assert.equal(h.timers.size,0);h.poller.stop();
});
for(const status of [401,403])test(`expired/forbidden session${status} stops repeated requests`,async()=>{
 const h=harness({fetchPage:async()=>{throw Object.assign(Error('denied'),{status});}});h.poller.start();await flush();assert.equal(h.states.at(-1),status===401?'authentication-required':'forbidden');assert.equal(h.timers.size,0);h.poller.kick();h.poller.resume();await flush();assert.equal(h.timers.size,0);h.poller.stop();
});
test('background polls back off and online/resume immediately checks without duplicate timers',async()=>{
 let online=false;const h=harness({online:()=>online,visible:()=>false});h.poller.start();await flush();assert.equal(h.fetches.length,0);online=true;h.poller.resume();await flush();assert.equal(h.fetches.length,1);assert.equal([...h.timers.values()][0].delay,30000);h.poller.stop();
});
test('corrupt persistence bootstraps safely and backward cursors require an explicit reset',async()=>{
 const corrupt=harness({loadCursor:async()=>'-bad'});corrupt.poller.start();await flush();assert.equal(corrupt.fetches[0].bootstrap,true);corrupt.poller.stop();
 let reset=false;const h=harness({loadCursor:async()=>'99',fetchPage:async()=>page('2',{resetRequired:reset})});h.poller.start();await flush();assert.deepEqual(h.saved,[]);reset=true;h.poller.kick();await flush();assert.deepEqual(h.saved,['2']);assert.equal(h.applied.length,1);h.poller.stop();
});
