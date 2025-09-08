import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import { mediaRouter } from './routers/media'
import { TriggerRouter } from './routers/Trigger'
import { mediaStorage } from './store/mediaStore'
import { upgradeWebSocket, websocket } from 'hono/bun'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { ServerWebSocket } from 'bun';
import { io,type WebSocketData } from './websocket-adapter'
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
app.route('/api/trigger', TriggerRouter)
app.get('/api/media/data', async (c) => {
  const data = await mediaStorage.getAll();
  return c.json(data);
})
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`)
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`)
  })
  socket.on('TriggerEvents:ID', (data) => {
    console.log('TriggerEvents:ID',data)
    io.emit('TriggerEvents:ID',data)
  })
})
app.get(
  '/ws',
  upgradeWebSocket((c) => {
    return {
      onOpen: (event, ws) => {
        // Usamos ws.raw para pasar el objeto nativo de Bun al adaptador
        io.handleOpen(ws.raw as ServerWebSocket<WebSocketData>);
      },

      onMessage: (event, ws) => {
        // Usamos ws.raw aquí también
        io.handleMessage(ws.raw as ServerWebSocket<WebSocketData>, event.data.toString());
      },
      onClose: (event, ws) => {
        // Y aquí también
        io.handleClose(ws.raw as ServerWebSocket<WebSocketData>, event.code, event.reason);
      },
      onError: (event, ws) => {
        console.error('Error de WebSocket:', event)
        // Opcional: notificar al adaptador si tienes un manejador de errores
        // io.handleError(ws.raw, event.error);
      }
    }
  })
)
const server = Bun.serve({
  fetch: app.fetch,
  port: 3000,
  websocket,
});
console.log(`Server running on port ${server.port}`);
