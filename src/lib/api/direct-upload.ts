// Direct browser transfer deliberately uses fetch without the authenticated API
// transport: POS bearer tokens, counter headers and cookies never reach storage.
type Request=<T>(path:string,options:RequestInit)=>Promise<T>;
type Metadata={kind:string;entityId?:string;staged?:boolean;uploadId?:string};
type Grant={mode:'multipart'}|{mode:'completed';result:{path:string}}|{mode:'direct';id:string;url:string;fields:Record<string,string>};
const retryIds=new Map<string,string>();
export async function uploadBrowserMedia(storePath:string,blob:Blob,metadata:Metadata,request:Request):Promise<string|null>{
 if(blob.size<1||blob.size>16*1024*1024||!['image/jpeg','image/png','image/webp'].includes(blob.type))throw new Error('Use a JPG, PNG or WebP image smaller than 16 MB.');
 const sha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(x=>x.toString(16).padStart(2,'0')).join('');
 const retryKey=JSON.stringify({storePath,kind:metadata.kind,entityId:metadata.entityId,staged:metadata.staged,sha256});
 let uploadId=metadata.uploadId??retryIds.get(retryKey);
 if(!uploadId){uploadId=crypto.randomUUID();if(retryIds.size>=32)retryIds.delete(retryIds.keys().next().value!);retryIds.set(retryKey,uploadId);}
 const grant=await request<Grant>(storePath+'/media/upload-grants',{method:'POST',body:JSON.stringify({...metadata,uploadId,mimeType:blob.type,size:blob.size,sha256})});
 if(grant.mode==='multipart'){retryIds.delete(retryKey);return null;}
 if(grant.mode==='completed'){retryIds.delete(retryKey);return grant.result.path;}
 const form=new FormData();for(const [key,value] of Object.entries(grant.fields))form.set(key,value);form.set('file',blob,'capture');
 const response=await fetch(grant.url,{method:'POST',body:form,credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',signal:AbortSignal.timeout(60000)});
 if(!response.ok)throw new Error('The private photo upload failed. Retry the photo.');
 const result=await request<{path:string}>(storePath+'/media/upload-grants/'+encodeURIComponent(grant.id)+'/complete',{method:'POST',body:'{}'});
 retryIds.delete(retryKey);return result.path;
}
