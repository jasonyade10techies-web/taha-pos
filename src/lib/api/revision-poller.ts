export interface RevisionChange {id:string;resource:string;revision:string;operation?:string}
export interface RevisionPage {cursor:string;hasMore:boolean;resetRequired?:boolean;changes:RevisionChange[]}
export type PollStatus='connecting'|'connected'|'reconnecting'|'authentication-required'|'forbidden'|'paused';
type Timer=ReturnType<typeof setTimeout>|number;
export interface RevisionPollOptions {
 fetchPage:(cursor:string,signal:AbortSignal,bootstrap:boolean)=>Promise<RevisionPage>;
 apply:(page:RevisionPage)=>Promise<void>;
 loadCursor?:()=>Promise<string|undefined>;saveCursor?:(cursor:string)=>Promise<void>;
 committed?:(page:RevisionPage)=>void;state?:(status:PollStatus)=>void;
 online?:()=>boolean;visible?:()=>boolean;epoch?:()=>number;
 schedule?:(callback:()=>void,delay:number)=>Timer;cancel?:(timer:Timer)=>void;
}
const validCursor=(value:unknown):value is string=>typeof value==='string'&&/^\d{1,19}$/.test(value)&&BigInt(value)<=9223372036854775807n;

/** Only invalidates/caches committed server state. Never retries a financial POST. */
export function createRevisionPoller(options:RevisionPollOptions){
 let stopped=false,paused=false,busy=false,dirty=false,loaded=false,authStopped=false,failures=0,lifecycle=0,cursor:string|undefined,timer:Timer|undefined,request:AbortController|undefined;
 const epoch=options.epoch?.(),schedule=options.schedule??((callback,delay)=>setTimeout(callback,delay)),cancel=options.cancel??(handle=>clearTimeout(handle));
 const current=()=>!stopped&&!paused&&(epoch===undefined||epoch===options.epoch?.());
 const clear=()=>{if(timer!==undefined)cancel(timer);timer=undefined;};
 const run=async()=>{
  if(!current()||authStopped||busy)return;
  if(options.online?.()===false){options.state?.('reconnecting');return;}
  busy=true;dirty=false;let delay=options.visible?.()===false?30000:4000;
  const runLifecycle=lifecycle,valid=()=>current()&&runLifecycle===lifecycle;
  request=new AbortController();
  try{
   if(!loaded){const stored=await options.loadCursor?.();if(!valid())return;cursor=validCursor(stored)?stored:undefined;loaded=true;}
   const page=await options.fetchPage(cursor??'0',request.signal,cursor===undefined);
   if(!valid())return;
   if(!validCursor(page.cursor)||!Array.isArray(page.changes)||page.changes.length>200||typeof page.hasMore!=='boolean'||
      page.changes.some(change=>typeof change.id!=='string'||typeof change.resource!=='string'||!validCursor(change.revision))||
      (!page.resetRequired&&cursor!==undefined&&BigInt(page.cursor)<BigInt(cursor))||
      (page.hasMore&&page.cursor===cursor))throw Error('Invalid synchronization response.');
   if(page.resetRequired||page.changes.length)await options.apply(page);
   if(!valid())return;
   if(page.cursor!==cursor)await options.saveCursor?.(page.cursor);
   if(!valid())return;
   cursor=page.cursor;failures=0;options.state?.('connected');delay=page.hasMore?100:delay;
   options.committed?.(page);
  }catch(cause){
   if(!valid())return;
   const status=cause&&typeof cause==='object'&&'status' in cause?cause.status:undefined;
   if(status===401||status===403){authStopped=true;options.state?.(status===401?'authentication-required':'forbidden');return;}
   failures++;options.state?.('reconnecting');delay=Math.max(options.visible?.()===false?30000:0,Math.min(30000,1000*2**Math.min(failures,5)));
  }finally{
   busy=false;request=undefined;
   if(current()&&!authStopped){clear();timer=schedule(()=>void run(),dirty?100:delay);}
  }
 };
 const kick=()=>{if(!current()||authStopped)return;clear();if(busy){dirty=true;return;}void run();};
 return {
  start(){options.state?.('connecting');kick();},kick,
  pause(){paused=true;lifecycle++;clear();request?.abort();options.state?.('paused');},
  resume(){if(stopped||authStopped)return;paused=false;kick();},
  stop(){stopped=true;lifecycle++;clear();request?.abort();},
 };
}
