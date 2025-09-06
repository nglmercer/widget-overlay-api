import { Hono } from "hono"
import path from "path"
import fs from "fs"
import { mkdir } from "fs/promises"
import { mediaStorage, ensureRecordForUrl } from "../store/mediaStore"
import { triggerStorage, queryTrigger } from "../store/triggerStore"
import type { MediaType, TriggerData } from "../store/types"
const TriggerRouter = new Hono()

TriggerRouter.get('/data', async (c) => {
  const data = await triggerStorage.getAll()
  return c.json(data)
})
TriggerRouter.get('/data/:type', async (c) => {
  const params = c.req.param()
  const type = params.type as MediaType
  if (!type || !["image", "audio", "video"].includes(type)) {
    return c.json({ error: "Invalid media type. Use image, audio, or video." }, 400)
  }
  const data = await triggerStorage.getAll()
  const filtered = Object.values(data).filter((m) => m.item?.type === type)
  return c.json(filtered)
})

TriggerRouter.post('/create', async (c) => {
  const data = (await c.req.json()) as TriggerData;
  if (!data.item){
    return c.json({ error: 'Item is required' }, 400)
  }
  if (!data.id) {
    data.id  = crypto.randomUUID()
  }
  await triggerStorage.save(data.id, data)
  return c.json(data, 201)
})

TriggerRouter.delete('/:id', async (c) => {
  const params = c.req.param()
  const id = params.id
  try {
    const trigger = await triggerStorage.load(id)
    if (!trigger) {
      return c.json({ error: 'Trigger not found' }, 404)
    }
    await triggerStorage.delete(id)
  } catch (e) {
    return c.json({ error: 'Failed to delete trigger' }, 500)
  }
  return c.json({ message: 'Trigger deleted' })
})

TriggerRouter.put('/:id', async (c) => {
  const params = c.req.param()
  const id = params.id
  const data = (await c.req.json()) as TriggerData
  if (id !== data.id) {
    return c.json({ error: 'ID in path and body do not match' }, 400)
  }
  try {
    const trigger = await triggerStorage.load(id)
    if (!trigger) {
      return c.json({ error: 'Trigger not found' }, 404)
    }
    await triggerStorage.save(id, data)
  } catch (e) {
    return c.json({ error: 'Failed to update trigger' }, 500)
  }
  return c.json(data)
})

TriggerRouter.get('/:id', async (c) => {
  const params = c.req.param()
  const id = params.id
  try {
    const trigger = await triggerStorage.load(id)
    if (!trigger) {
      return c.json({ error: 'Trigger not found' }, 404)
    }
    return c.json(trigger)
  } catch (e) {
    return c.json({ error: 'Failed to retrieve trigger' }, 500)
  }
})

TriggerRouter.get('/query', async (c) => {
  const { type, url, name, id } = c.req.query()
  const result = await queryTrigger({ type: type as MediaType, url, name, id })
  return c.json(result)
})
export { TriggerRouter}
