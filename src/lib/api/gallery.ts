import type { MediaImage } from '../../types/demo';
import { apiRequest } from './client';
import { apiStoreMedia, storePath } from './media';
import { imageEdit } from '../image-edits';
import { mapLimit } from '../photo-quality';
export function apiGallery(kind: string, entityId: string): Promise<MediaImage[]> {
  return apiRequest(`${storePath()}/media?entityType=${encodeURIComponent(kind)}&entityId=${encodeURIComponent(entityId)}`);
}
export async function saveGallery(images: MediaImage[], kind: string, entityId: string, staged = false) {
  const previous = await apiGallery(kind, entityId);
  const next = await mapLimit(images, 2, async (image, sortOrder) => {
    const edit = imageEdit(image.url) || image;
    let path = await apiStoreMedia(edit.originalUrl?.startsWith('data:') ? edit.originalUrl : image.url, kind, image.path, entityId, undefined, String(sortOrder), staged);
    if (edit.crop && edit.originalUrl?.startsWith('data:')) {
      path = (await apiRequest<{path: string}>(`${storePath()}/media/crop`, {method: 'POST', body: JSON.stringify({path, crop: edit.crop, staged})})).path;
    }
    return {url: 'taha-media:' + path, path, id: path.split('/').at(-1)?.split('.')[0], originalUrl: edit.originalUrl, crop: edit.crop};
  });
  if(staged)return next;
  // Order/primary mutations remain sequential after bounded parallel uploads.
  for (const [sortOrder, image] of next.entries()) {
    if (image.id) await apiRequest(`${storePath()}/media/${image.id}`, {method: 'PATCH', body: JSON.stringify({sortOrder, primary: sortOrder === 0, entityId})});
  }
  for (const removed of previous.filter(p => !next.some(n => n.path === p.path))) {
    await apiRequest(`${storePath()}/media/${removed.id}`, {method: 'PATCH', body: JSON.stringify({entityId: null})});
  }
  return next;
}
