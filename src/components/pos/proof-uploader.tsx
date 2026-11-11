import {useState} from "react";
import {ImageUploader} from "../ui/workspace";
import {CameraCapture} from "../camera/camera-capture";
import {storeAsset} from "../../lib/supabase/business-assets";
import {localDemoEnabled} from "../../lib/config";
export function ProofUploader({value,onChange,amount,reference}:{value:string;onChange:(value:string)=>void;amount?:number;reference?:string}) {
  const [preview,setPreview]=useState(value), [error,setError]=useState(""), [uploading,setUploading]=useState(false);
  const selected = (image:string) => {
    setPreview(image);setError("");onChange("");
    if(localDemoEnabled || !image){onChange(image);return;}
    setUploading(true);void storeAsset(image,"proof").then(onChange).catch(cause=>setError(cause.message)).finally(()=>setUploading(false));
  };
  return <><ImageUploader evidence value={preview} label="Upload payment proof" onChange={selected} phoneAction={<CameraCapture type="payment-proof" title="Payment Proof Required" amount={amount} reference={reference ?? "Current sale"} onImage={selected} onStoredImage={({preview,path})=>{setPreview(preview);onChange(path);}} compact/>}/>{uploading && <p role="status">Uploading private proof…</p>}{error && <p role="alert" className="text-danger">{error}</p>}</>;
}
