import { DataStorage } from 'json-obj-manager';
import { JSONFileAdapter } from 'json-obj-manager/node';
import path from 'path';
import type{ MediaType,MediaItem,TriggerData } from './types';
import { mediaStorage } from './mediaStore';
const TriggerPath = path.join(process.cwd(), 'triggers', 'triggers.json');

const triggerStorage = new DataStorage<TriggerData>(
  new JSONFileAdapter(TriggerPath)
)
async function queryTrigger(params: {
  url: string
  name?: string
  id?: string
  type?: MediaType
}): Promise< Record<string, TriggerData>> {
  const { type, url, name, id } = params
  const all = await triggerStorage.getAll()
  if (!params || Object.keys(params).length === 0) {
    return all
  }
  const filtered = Object.values(all).filter((r) => {
    if (id && r.id !== id) return false
    if (name && r.name !== name) return false
    if (type && r.item?.type !== type) return false
    if (url && r.item?.url !== url) return false
    return true
  })
  return filtered.reduce((acc, cur) => {
    acc[cur.id] = cur
    return acc
  }, {} as Record<string, TriggerData>)
}
export {triggerStorage,queryTrigger}