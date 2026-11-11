import {ApiError} from "./api/client";
import {bridgeRequest as apiRequest} from "./device-bridge/client";
import {bridgeStorePath as storePath} from "./device-bridge/service";
import {useCameraStore} from "../stores/camera-store";
import {imageDataBlob} from "./media";
import type {CameraJob} from "../types/phase4b";
type Request=Omit<CameraJob,"id"|"status"|"createdAt"|"expiresAt">&{fallback?:boolean};
const types:Record<string,CameraJob["type"]>={product:"product-photo",device:"used-device-photo",repair:"repair-intake",profile:"profile-picture",customer:"customer-photo",damage:"damage-evidence",document:"receipt-document"};
const normalize=(job:CameraJob&{imageUrl?:string})=>({...job,type:types[job.type]||job.type,imageDataUrl:job.imageUrl||job.imageDataUrl});
const cameraPath=()=>`${storePath()}/camera`;
export function cameraError(cause:unknown){
 if(cause instanceof ApiError){if(cause.status===0)return "Could not reach the shop server. Your photo is retained; try again when connected.";if(cause.status===401)return "Your login has expired. Sign in again.";if(cause.status===413)return "The shop rejected this file because it is too large.";if(cause.status===403||cause.status===404)return "This photo request is no longer assigned to your phone.";return cause.message;}
 return cause instanceof Error&&!/fetch|network|socket|http/i.test(cause.message)?cause.message:"The photo could not be uploaded. Try again when connected.";
}
export const cameraService={
 async request(input:Request){if(!navigator.onLine)throw new Error("Connect to the shop before requesting a phone photo.");const job=normalize(await apiRequest<CameraJob>(`${cameraPath()}/jobs`,{method:"POST",body:JSON.stringify({...input,label:input.title})}));useCameraStore.getState().receive(job);return job;},
 async list(terminalId?:string){return (await apiRequest<CameraJob[]>(`${cameraPath()}/jobs${terminalId?`?terminalId=${encodeURIComponent(terminalId)}`:""}`)).map(normalize);},
 async update(id:string,patch:Partial<CameraJob>){const job=normalize(await apiRequest<CameraJob>(`${cameraPath()}/jobs/${id}`,{method:"PATCH",body:JSON.stringify(patch)}));useCameraStore.getState().receive(job);},
 async complete(job:CameraJob,image:string,captureId:string=crypto.randomUUID()){
  // The server checks expiration after acknowledging an already committed capture ID.
  const blob=imageDataBlob(image),form=new FormData();form.set("file",new File([blob],"capture.jpg",{type:blob.type}));form.set("captureId",captureId);
  const result=normalize(await apiRequest<CameraJob>(`${cameraPath()}/jobs/${job.id}/captures`,{method:"POST",body:form}));useCameraStore.getState().receive(result);return result;
 },
 async finish(job:CameraJob){const result=normalize(await apiRequest<CameraJob>(`${cameraPath()}/jobs/${job.id}/finish`,{method:"POST"}));useCameraStore.getState().receive(result);},
 async handoff(id:string){const result=normalize(await apiRequest<CameraJob>(`${cameraPath()}/jobs/${id}/qr`,{method:"POST"}));useCameraStore.getState().receive(result);return result;},
 async claim(id:string,token:string){const result=normalize(await apiRequest<CameraJob>(`${cameraPath()}/jobs/${id}/claim`,{method:"POST",body:JSON.stringify({token})}));useCameraStore.getState().receive(result);return result;},
 async diagnostic(){const result=normalize(await apiRequest<CameraJob>(`${cameraPath()}/test`,{method:"POST"}));useCameraStore.getState().receive(result);return result;},
 async removeDiagnostic(job:CameraJob){await apiRequest(`${cameraPath()}/jobs/${job.id}/test`,{method:"DELETE"});useCameraStore.getState().remove(job.id);},
};
