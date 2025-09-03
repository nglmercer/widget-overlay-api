import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import { mediaRouter } from './routers/media'
import { mediaStorage } from './store/mediaStore'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'  
const app = new Hono()
app.use(logger())
app.use(cors({
  origin: '*',
}))
app.get('/', (c) => {
  return c.text('Hello Hono!')
})

// Serve uploaded files
app.use('/uploads/*', serveStatic({ root: './' }))

// Mount media routes
app.route('/api/media', mediaRouter)
app.get('/api/media/data', async (c) => {
  const data = await mediaStorage.getAll();
  return c.json(data);
})

export default app
