import { useState } from "react";
import type { MediaImage } from "../../types/demo";
import { MediaUploader } from "../../components/media/media-uploader";
import { CameraCapture } from "../../components/camera/camera-capture";
const repairPhotoCategories = ["Before", "After", "Damage", "Customer-provided"] as const;
export type RepairPhoto = MediaImage & { category: string };
export function RepairMedia({ photos, onChange, entityId }: { photos: RepairPhoto[]; onChange: (photos: RepairPhoto[]) => void; entityId: string }) {
  const [category, setCategory] = useState<string>("Before");
  const [preparing,setPreparing] = useState(false);
  const current = photos.filter(p => p.category === category);
  const replace = (urls: string[]) => onChange([...photos.filter(p => p.category !== category), ...urls.map(url => current.find(p => p.url === url) ?? { url, category })]);
  const append = (image: MediaImage) => onChange([...photos, { ...image, category }]);
  return <section className="repair-photo-section"><h3>Device photos</h3><p className="text-sm text-muted">Keep intake condition, completed repairs, and supporting evidence together.</p><div className="table-tabs">{repairPhotoCategories.map(c => <button key={c} type="button" disabled={preparing} aria-pressed={c === category} className={c === category ? "active" : ""} onClick={() => setCategory(c)}>{c} ({photos.filter(p => p.category === c).length})</button>)}</div><MediaUploader values={current.map(p => p.url)} onChange={replace} onBusyChange={setPreparing} multiple evidence label={`Upload ${category.toLowerCase()} photos`}/><CameraCapture key={category} type="repair-intake" title={`Repair ${category} Photo`} targetSlot={`repair.${category.toLowerCase()}`} entityId={entityId} onImage={url => append({url})} onStoredImage={({preview,path}) => append({url:preview,path})} compact/></section>;
}
