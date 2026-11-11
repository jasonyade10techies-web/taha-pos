import { apiEnabled } from "../config";
import { apiMediaUrls, apiStoreMedia } from "../api/media";
import { requireSupabase } from "./client";
import { activeStore, databaseError } from "./repository-utils";
import { uploadImageTo } from "./product-images";
import {useSessionStore} from "../../stores/session-store";
export async function storeAsset(value: string, folder: "proof" | "customers" | "payment-qr", existing = "") {
  if (apiEnabled) return apiStoreMedia(value, folder === "customers" ? "customer" : folder, existing);
  if (!value) return "";
  if (value.startsWith("data:")) {
    const digest=[...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)))].map(b=>b.toString(16).padStart(2,"0")).join("");
    const key=`taha-asset:${activeStore()}:${useSessionStore.getState().profile?.id}:${folder}:${digest}`;
    const existingPath=sessionStorage.getItem(key);if(existingPath)return existingPath;
    const path=await uploadImageTo("business-assets",`${activeStore()}/${folder}`,value);sessionStorage.setItem(key,path);return path;
  }
  if (value.startsWith(`${activeStore()}/${folder}/`)) return value;
  if (existing) return existing;
  throw new Error("Select a new image or an existing private attachment.");
}
export async function assetUrls(paths: string[]) {
  if (apiEnabled) return new Map(Object.entries(await apiMediaUrls(paths)));
  if (!paths.length) return new Map<string,string>();
  const {data,error} = await requireSupabase().storage.from("business-assets").createSignedUrls([...new Set(paths)],900);
  if (error) throw databaseError(error);
  return new Map((data ?? []).flatMap(x => x.path && x.signedUrl && !x.error ? [[x.path,x.signedUrl] as const] : []));
}
export async function proofUrl(path: string) { return (await assetUrls([path])).get(path); }
