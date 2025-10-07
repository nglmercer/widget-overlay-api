import { Hono } from "hono"
import path from "path"
import fs from "fs"
import { mkdir } from "fs/promises"
import { mediaStorage, ensureRecordForUrl } from "../store/mediaStore"
import type { MediaType } from "../store/types"
const mediaRouter = new Hono()


const EXT_BY_MIME: Record<string, string> = {
  // image
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/svg+xml": ".svg",
  // audio
  "audio/mpeg": ".mp3",
  "audio/wav": ".wav",
  "audio/ogg": ".ogg",
  "audio/webm": ".weba",
  // video
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/ogg": ".ogv",
  // subtitle
  "text/vtt": ".vtt",
  "application/x-subrip": ".srt",
  "text/x-ssa": ".ssa",
  "text/x-ass": ".ass",
}

// Validation sets for file extensions
const EXT_IMAGE = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"]) 
const EXT_AUDIO = new Set([".mp3", ".wav", ".ogg", ".weba"]) 
const EXT_VIDEO = new Set([".mp4", ".webm", ".ogv"]) 
const EXT_SUBTITLE = new Set([".vtt", ".srt", ".ssa", ".ass", ".sub"])

function extFromFile(file: File): string {
  const byMime = EXT_BY_MIME[file.type]
  if (byMime) return byMime
  const name = file.name || ""
  const dot = name.lastIndexOf(".")
  return dot >= 0 ? name.slice(dot).toLowerCase() : ""
}

function isTypeMatch(file: File, type: MediaType): boolean {
  if (type === "subtitle") {
    const ext = extFromFile(file)
    return EXT_SUBTITLE.has(ext)
  }
  return file.type?.startsWith(type + "/") ?? false
}

function getDirectoryForType(type: MediaType): string {
  return type === "subtitle" ? "subtitles" : `${type}s`
}

async function getFileSize(filePath: string): Promise<number> {
  try {
    const stats = await fs.promises.stat(filePath)
    return stats.size
  } catch {
    return 0
  }
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

mediaRouter.post("/upload/:type", async (c) => {
  const params = c.req.param()
  const type = params.type as MediaType
  if (!type || !["image", "audio", "video", "subtitle"].includes(type)) {
    return c.json({ error: "Invalid media type. Use image, audio, video, or subtitle." }, 400)
  }

  let formData: FormData
  try {
    formData = await c.req.formData()
  } catch (e) {
    return c.json({ error: "Invalid form data. Expected multipart/form-data." }, 400)
  }

  const file = formData.get("file")
  if (!(file instanceof File)) {
    return c.json({ error: "Missing file field 'file'." }, 400)
  }

  if (!isTypeMatch(file, type)) {
    return c.json({ error: `Uploaded file does not match type '${type}'.` }, 400)
  }

  const id = crypto.randomUUID()
  const ext = extFromFile(file)
  const baseDir = path.join(process.cwd(), "uploads", getDirectoryForType(type))
  const fileName = `${id}${ext}`
  const filePath = path.join(baseDir, fileName)

  await mkdir(baseDir, { recursive: true })

  // Persist file to disk
  await Bun.write(filePath, file)

  // Get file size
  const fileSize = await getFileSize(filePath)

  const url = `/uploads/${getDirectoryForType(type)}/${fileName}`
  const name = (formData.get("name") ?? file.name ?? fileName).toString()

  let meta: Record<string, unknown> = {}
  const metaRaw = formData.get("metadata")
  if (typeof metaRaw === "string") {
    try {
      meta = JSON.parse(metaRaw)
    } catch {
      return c.json({ error: "Invalid metadata JSON." }, 400)
    }
  }

  const record = {
    id,
    type,
    url,
    name,
    size: fileSize,
    sizeFormatted: formatFileSize(fileSize),
    metadata: meta,
  } as const

  await mediaStorage.save(id, record)

  return c.json(record, 201)
})

mediaRouter.delete('/:id', async (c) => {
  const params = c.req.param()
  const id = params.id
  
  try {
    const media = await mediaStorage.load(id)
    if (!media) {
      return c.json({ error: 'Media not found' }, 404)
    }
    
    if (media.url) {
      const filePath = path.join(process.cwd(), media.url)
      try {
        await fs.promises.unlink(filePath)
      } catch (e) {
        return c.json({ error: 'Failed to delete media file' }, 500)
      }
    }
    
    await mediaStorage.delete(id)
    return c.json({ message: 'Media deleted successfully' })
  } catch (e) {
    return c.json({ error: 'Failed to delete media' }, 500)
  }
})

mediaRouter.post('/sync', async (c) => {
  const types: MediaType[] = ['image', 'audio', 'video', 'subtitle']
  const existing = await mediaStorage.getAll()
  const known = new Set(Object.values(existing).map((m) => m.url))

  let addedTotal = 0
  const addedByType: Record<MediaType, number> = { 
    image: 0, 
    audio: 0, 
    video: 0, 
    subtitle: 0 
  }

  for (const type of types) {
    const dir = path.join(process.cwd(), 'uploads', getDirectoryForType(type))
    let files: string[] = []
    
    try {
      files = await fs.promises.readdir(dir)
    } catch {
      continue
    }
    
    for (const file of files) {
      if (file.startsWith('.')) continue

      const ext = path.extname(file).toLowerCase()
      const extSet = type === 'image' ? EXT_IMAGE 
                   : type === 'audio' ? EXT_AUDIO 
                   : type === 'video' ? EXT_VIDEO 
                   : EXT_SUBTITLE

      if (!extSet.has(ext)) continue

      const url = `/uploads/${getDirectoryForType(type)}/${file}`
      if (known.has(url)) continue

      await ensureRecordForUrl({ type, url, name: file })
      known.add(url)
      addedTotal++
      addedByType[type]++
    }
  }

  return c.json({
    message: 'Sync completed successfully',
    added: addedTotal,
    details: addedByType,
  })
})

mediaRouter.get('/data/:type', async (c) => {
  const params = c.req.param()
  const type = params.type as MediaType
  
  if (!type || !["image", "audio", "video", "subtitle"].includes(type)) {
    return c.json({ error: "Invalid media type. Use image, audio, video, or subtitle." }, 400)
  }
  
  const data = await mediaStorage.getAll()
  const filtered = Object.values(data).filter((m) => m.type === type)
  
  return c.json(filtered)
})

mediaRouter.get('/stats', async (c) => {
  const data = await mediaStorage.getAll()
  const allMedia = Object.values(data)
  
  const stats = {
    total: {
      count: allMedia.length,
      size: 0,
      sizeFormatted: "0 B"  
    },
    byType: {} as Record<MediaType, { count: number; size: number; sizeFormatted: string }>
  }

  const types: MediaType[] = ['image', 'audio', 'video', 'subtitle']
  
  for (const type of types) {
    stats.byType[type] = { count: 0, size: 0, sizeFormatted: "0 B" }
  }

  for (const media of allMedia) {
    // Calculate actual file size from disk
    const filePath = path.join(process.cwd(), media.url)
    const size = await getFileSize(filePath)
    
    stats.total.size += size
    
    if (media.type in stats.byType) {
      stats.byType[media.type].count++
      stats.byType[media.type].size += size
    }
  }

  stats.total.sizeFormatted = formatFileSize(stats.total.size)
  
  for (const type of types) {
    stats.byType[type].sizeFormatted = formatFileSize(stats.byType[type].size)
  }

  return c.json(stats)
})

mediaRouter.get('/:id/size', async (c) => {
  const params = c.req.param()
  const id = params.id
  
  try {
    const media = await mediaStorage.load(id)
    if (!media) {
      return c.json({ error: 'Media not found' }, 404)
    }
    
    const filePath = path.join(process.cwd(), media.url)
    const size = await getFileSize(filePath)
    
    return c.json({
      id: media.id,
      size,
      sizeFormatted: formatFileSize(size)
    })
  } catch (e) {
    return c.json({ error: 'Failed to get file size' }, 500)
  }
})

export { mediaRouter }