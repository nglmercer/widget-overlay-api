import { DataStorage } from 'json-obj-manager';
import { JSONFileAdapter } from 'json-obj-manager/node';
import path from 'path';
import type{ MediaType,MediaItem } from './types';
const MediaPath = path.join(process.cwd(), 'media', 'media.json');



const mediaStorage = new DataStorage<MediaItem>(
  new JSONFileAdapter(MediaPath)
)

export async function ensureRecordForUrl(params: {
  type: MediaType
  url: string
  name?: string
  metadata?: Record<string, any>
}): Promise<MediaItem> {
  const { type, url, name, metadata } = params
  const all = await mediaStorage.getAll()

  // --- FIX IS HERE ---
  // Convert the 'all' object's values into an array, then search that array.
  const existing = Object.values(all).find((r) => r.url === url)

  if (existing) return existing

  const id = crypto.randomUUID()
  const record: MediaItem = {
    id,
    type,
    url,
    name: name ?? path.basename(url),
    metadata: metadata ?? {},
  }
  await mediaStorage.save(id, record)
  return record
}

export { mediaStorage }