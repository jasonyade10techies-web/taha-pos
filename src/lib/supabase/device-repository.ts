import type {Repositories} from "../repositories/interfaces";
import type {DevicePurchase} from "../../types/demo";
import {activeStore,rpc} from "./repository-utils";
import {json} from "./transaction-repositories";
import {signedImages,uploadProductImage} from "./product-images";
async function display(d:DevicePurchase) {
 const urls=await signedImages(d.photos ?? []);
 return {...d,photos:d.photos.map(p=>urls.get(p) ?? "")};
}
export const remoteDevices:Repositories["devices"]={
 async list(){const rows=await rpc("device_data",{p_store_id:activeStore(),p_input:{action:"list"}}) as unknown as DevicePurchase[];return Promise.all(rows.map(display));},
 async get(id){return(await this.list()).find(d=>d.id===id);},
 async purchase(d,locationId){
  const photos=await Promise.all(d.photos.map(p=>p.startsWith("data:")?uploadProductImage(activeStore(),d.id,p):Promise.resolve(p)));
  return display(await rpc("device_data",{p_store_id:activeStore(),p_input:json({...d,photos,locationId,action:"purchase"})}) as unknown as DevicePurchase);
 },
 async updateStatus(id,status){await rpc("device_data",{p_store_id:activeStore(),p_input:{action:"status",id,status}});},
};
