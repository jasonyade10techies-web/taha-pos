type RequestHandler=(req:unknown,res:unknown)=>unknown;
type Response={headersSent?:boolean;statusCode:number;setHeader:(name:string,value:string)=>void;end:(body:string)=>void};

/** Cache only application initialization, never a user/session/transaction. */
export function createFunctionHandler(initialize:()=>Promise<RequestHandler>){
 let initialized:Promise<RequestHandler>|undefined;
 return async(req:unknown,res:unknown)=>{
  try{
   if(!initialized)initialized=initialize().catch(error=>{initialized=undefined;throw error;});
   const handle=await initialized;return await handle(req,res);
  }catch{
   const response=res as Response;if(response.headersSent)return;
   response.statusCode=503;response.setHeader('Content-Type','application/json');response.setHeader('Cache-Control','private, no-store');response.setHeader('Retry-After','3');
   response.end(JSON.stringify({statusCode:503,message:'The shop service is temporarily unavailable. Please retry.',code:'STARTUP_UNAVAILABLE'}));
  }
 };
}
