import { DataStorage } from 'json-obj-manager'
import { JSONFileAdapter } from 'json-obj-manager/node'
import path from 'path'
const MediaPath = path.join(process.cwd(), 'media', 'media.json')

export interface MediaData {
  id: string
  type: 'image' | 'audio' | 'video'
  url: string
  name: string
  metadata: {
    [key: string]: any
  }
}

const mediaStorage = new DataStorage<MediaData>(
  new JSONFileAdapter(MediaPath)
)

export async function ensureRecordForUrl(params: {
  type: 'image' | 'audio' | 'video'
  url: string
  name?: string
  metadata?: Record<string, any>
}): Promise<MediaData> {
  const { type, url, name, metadata } = params
  const all = await mediaStorage.getAll()

  // --- FIX IS HERE ---
  // Convert the 'all' object's values into an array, then search that array.
  const existing = Object.values(all).find((r) => r.url === url)

  if (existing) return existing

  const id = crypto.randomUUID()
  const record: MediaData = {
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