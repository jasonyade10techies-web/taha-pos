export const imageTypes = ["image/jpeg", "image/png", "image/webp"];
/** Decode locally: fetch(data:) is blocked by the APK's intentionally restrictive CSP. */
export function imageDataBlob(data:string){
  const match=/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\r\n]+)$/.exec(data);
  if(!match)throw new Error("This photo could not be opened. Choose another image.");
  const binary=atob(match[2]);if(binary.length>10*1024*1024)throw new Error("Choose an image smaller than 10 MB.");
  return new Blob([Uint8Array.from(binary,c=>c.charCodeAt(0))],{type:match[1]});
}
export async function prepareImage(file: File, { evidence = false, maxSize = 10 * 1024 * 1024, compress = true, quality = 82, longEdge = evidence ? 2400 : 1800 }: {evidence?:boolean;maxSize?:number;compress?:boolean;quality?:number;longEdge?:number} = {}) {
  if (!imageTypes.includes(file.type) || !/\.(jpe?g|png|webp)$/i.test(file.name)) throw new Error("Choose a JPG, PNG or WebP image.");
  if (file.size > maxSize) throw new Error("This image is too large. Choose a file up to 10 MB.");
  const bitmap = await createImageBitmap(file,{imageOrientation:"from-image"}).catch(() => { throw new Error("This file could not be read as an image."); });
  if (bitmap.width * bitmap.height > 50_000_000) { bitmap.close(); throw new Error("This image is too large to process. Use a smaller photo."); }
  const scale = Math.min(1, longEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image preview is unavailable in this browser.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
  // Bounds remain mandatory even when quality compression is disabled.
  return canvas.toDataURL("image/jpeg", compress ? Math.max(evidence ? .9 : .4, Math.min(1,quality/100)) : 1);
}
