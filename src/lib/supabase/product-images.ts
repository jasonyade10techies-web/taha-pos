import { requireSupabase } from "./client";
import { databaseError } from "./repository-utils";
const bucket = "product-images";
export async function signedImages(paths: (string | null | undefined)[]) {
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  if (!unique.length) return new Map<string, string>();
  const { data, error } = await requireSupabase()
    .storage.from(bucket)
    .createSignedUrls(unique, 900);
  if (error)
    throw new Error(
      "Product images could not be loaded. Check Storage configuration and your connection.",
    );
  return new Map<string, string>(
    (data ?? []).flatMap((x) =>
      !x.error && x.path && x.signedUrl ? [[x.path, x.signedUrl]] : [],
    ),
  );
}
export async function uploadProductImage(
  store: string,
  product: string,
  dataUrl: string,
) {
  return uploadImageTo(bucket, `${store}/${product}`, dataUrl);
}
export async function uploadImageTo(bucketName: string, prefix: string, dataUrl: string) {
  if (!/^data:image\/(png|jpeg|webp);base64,/.test(dataUrl))
    throw new Error("Choose a PNG, JPEG or WebP product image.");
  const mime = dataUrl.slice(5, dataUrl.indexOf(";"));
  const source = new Blob(
    [Uint8Array.from(atob(dataUrl.split(",")[1]), (c) => c.charCodeAt(0))],
    { type: mime },
  );
  if (source.size > 2097152)
    throw new Error("Product images must be 2 MB or smaller.");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(source);
  } catch {
    throw new Error(
      "This image could not be decoded. Choose a valid PNG, JPEG or WebP file.",
    );
  }
  const scale = Math.min(1, 720 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) =>
        b ? resolve(b) : reject(new Error("Unable to prepare product image.")),
      "image/webp",
      0.8,
    ),
  );
  if (blob.size > 2097152) throw new Error("Choose a smaller image.");
  const path = `${prefix}/${crypto.randomUUID()}.webp`;
  const { error } = await requireSupabase()
    .storage.from(bucketName)
    .upload(path, blob, { contentType: "image/webp", upsert: false });
  if (error)
    throw new Error(
      "Image upload failed. Check your product permissions and Storage configuration.",
    );
  return path;
}
export async function removeProductImage(path: string) {
  const { error } = await requireSupabase().storage.from(bucket).remove([path]);
  if (error) throw databaseError(error);
}
