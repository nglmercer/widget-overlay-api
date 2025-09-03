import { Hono } from "hono"
import path from "path"
import fs from "fs"
import { mkdir } from "fs/promises"
import { mediaStorage, ensureRecordForUrl } from "../store/mediaStore"

const mediaRouter = new Hono()

type AllowedType = "image" | "audio" | "video"

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
}

// Validation sets for file extensions used when syncing external files
const EXT_IMAGE = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"]) 
const EXT_AUDIO = new Set([".mp3", ".wav", ".ogg", ".weba"]) 
const EXT_VIDEO = new Set([".mp4", ".webm", ".ogv"]) 

function extFromFile(file: File): string {
  const byMime = EXT_BY_MIME[file.type]
  if (byMime) return byMime
  const name = file.name || ""
  const dot = name.lastIndexOf(".")
  return dot >= 0 ? name.slice(dot) : ""
}

function isTypeMatch(file: File, type: AllowedType): boolean {
  return file.type?.startsWith(type + "/") ?? false
}

mediaRouter.post("/upload/:type", async (c) => {
  const params = c.req.param()
  const type = params.type as AllowedType
  if (!type || !["image", "audio", "video"].includes(type)) {
    return c.json({ error: "Invalid media type. Use image, audio, or video." }, 400)
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
    return c.json({ error: `Uploaded file MIME '${file.type}' does not match type '${type}'.` }, 400)
  }

  const id = crypto.randomUUID()
  const ext = extFromFile(file)
  const baseDir = path.join(process.cwd(), "uploads", `${type}s`)
  const fileName = `${id}${ext}`
  const filePath = path.join(baseDir, fileName)

  await mkdir(baseDir, { recursive: true })

  // Persist file to disk
  await Bun.write(filePath, file)

  const url = `/uploads/${type}s/${fileName}`
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
    metadata: meta,
  } as const

  await mediaStorage.save(id, record)

  return c.json(record, 201)
})
mediaRouter.delete('/:id', async (c) => {
  const params = c.req.param();
  const id = params.id;
  try {
    const media = await mediaStorage.load(id);
    if (!media) {
      return c.json({ error: 'Media not found' }, 404);
    }
    if (media.name) {
      const filePath = path.join(process.cwd(), media.url);
      try {
        await fs.promises.unlink(filePath);
        await mediaStorage.delete(id);
      } catch (e) {
        return c.json({ error: 'Failed to delete media file' }, 500);
      }
    }
  } catch (e) {
    return c.json({ error: 'Failed to delete media' }, 500);
  }
  return c.json({ message: 'Media deleted' });
})

mediaRouter.post('/sync', async (c) => {
  const types: AllowedType[] = ['image', 'audio', 'video']
  const existing = await mediaStorage.getAll()

  // --- FIX IS HERE ---
  // Primero convierte el objeto 'existing' a un array de sus valores
  const known = new Set(Object.values(existing).map((m) => m.url))

  let addedTotal = 0
  const addedByType: Record<AllowedType, number> = { image: 0, audio: 0, video: 0 }

  for (const type of types) {
    const dir = path.join(process.cwd(), 'uploads', `${type}s`)
    let files: string[] = []
    try {
      files = await fs.promises.readdir(dir)
    } catch {
      // El directorio puede no existir todavía, lo ignoramos y continuamos
      continue
    }
    for (const file of files) {
      // Ignorar archivos ocultos como .DS_Store
      if (file.startsWith('.')) continue

      const ext = path.extname(file).toLowerCase()
      if (
        (type === 'image' && !EXT_IMAGE.has(ext)) ||
        (type === 'audio' && !EXT_AUDIO.has(ext)) ||
        (type === 'video' && !EXT_VIDEO.has(ext))
      ) {
        // La extensión no coincide con el tipo de directorio, ignorar
        continue
      }

      const url = `/uploads/${type}s/${file}`
      if (known.has(url)) continue

      await ensureRecordForUrl({ type, url, name: file })
      known.add(url) // Añade al set para no procesarlo de nuevo en esta misma ejecución
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
  const type = params.type as AllowedType
  if (!type || !["image", "audio", "video"].includes(type)) {
    return c.json({ error: "Invalid media type. Use image, audio, or video." }, 400)
  }
  const data = await mediaStorage.getAll()
  const filtered = Object.values(data).filter((m) => m.type === type)
  return c.json(filtered)
})
export { mediaRouter }