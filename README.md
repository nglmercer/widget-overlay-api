# Widget Overlay API

Lightweight media upload and management API built on Bun + Hono. It lets you upload images, audio, and video, serves the uploaded files statically, and persists metadata to a JSON store.

## Tech stack
- Runtime: Bun
- Web framework: Hono
- Storage: local filesystem for files, json-obj-manager (JSON file) for metadata

## Quick start
1) Install deps
```sh
bun install
```
2) Run dev server (hot reload)
```sh
bun run dev
```
3) Open
```
http://localhost:3000
```

## Project structure
```
.
├─ src/
│  ├─ index.ts                # App setup, middleware, route mounting
│  ├─ routers/
│  │  └─ media.ts             # Media upload + delete endpoints
│  └─ store/
│     └─ mediaStore.ts        # JSON-backed metadata store
├─ uploads/                   # Created at runtime (images/, audios/, videos/)
├─ media/media.json           # Created at runtime by json-obj-manager
└─ package.json
```

## Runtime behavior
- CORS is enabled for all origins and request logging is active.
- Static files are served under `/uploads/*` from the project root.
- Media routes are mounted at `/api/media`.

## Storage
- Files: `uploads/images`, `uploads/audios`, `uploads/videos` (created on demand)
- Metadata: `media/media.json` managed by json-obj-manager

## API

### Upload media
POST `/api/media/upload/:type`
- `:type` = `image` | `audio` | `video`
- Content-Type: `multipart/form-data`
- Fields:
  - `file` (required) — the binary file
  - `name` (optional) — display name
  - `metadata` (optional) — JSON string (e.g. `{"duration": 120}`)
- 201 Response
```json
{
  "id": "uuid",
  "type": "image|audio|video",
  "url": "/uploads/<type>s/<id>.<ext>",
  "name": "<name>",
  "metadata": { }
}
```
- Error cases: 400 invalid type, missing `file`, invalid form data, MIME/type mismatch, invalid metadata JSON.
- Example
```sh
curl -X POST "http://localhost:3000/api/media/upload/image" \
  -F "file=@/path/to/picture.png" \
  -F "name=My picture" \
  -F 'metadata={"tags":["cover"]}'
```

### List media
GET `/api/media/data`
- Returns an array of all media records
```sh
curl http://localhost:3000/api/media/data
```

### Delete media
DELETE `/api/media/:id`
- Deletes the file from disk and removes its metadata record
- Responses: `200 {"message":"Media deleted"}`, `404 Media not found`, `500 Failed to delete media/file`
```sh
curl -X DELETE http://localhost:3000/api/media/<id>
```

## Notes
- Access uploaded files directly at the `url` returned in the upload response.
- IDs are UUID v4 and file extensions are inferred from MIME type or filename.
- Dev script uses `bun run --hot` for instant reloads.
