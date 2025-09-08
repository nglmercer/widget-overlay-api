// Fichero: BunSocketServer.ts

import type { ServerWebSocket } from "bun";

// Interfaz para extender el objeto 'ws' de Bun y añadirle nuestros datos
export interface WebSocketData {
  id: string;
  socket: BunSocket; // Referencia a nuestra instancia de socket personalizada
}

/**
 * Representa una conexión de un cliente individual.
 * Imita la instancia 'socket' de Socket.IO.
 */
class BunSocket {
  public id: string;
  private ws: ServerWebSocket<WebSocketData>;
  private server: BunSocketServer;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();

  constructor(ws: ServerWebSocket<WebSocketData>, server: BunSocketServer) {
    this.id = ws.data.id;
    this.ws = ws;
    this.server = server;
  }

  // Escucha eventos del cliente (socket.on('evento', ...))
  on(event: string, callback: (data: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  // Envía un evento a este cliente específico (socket.emit('evento', ...))
  emit(event: string, data: any) {
    const payload = JSON.stringify({ event, data });
    this.ws.send(payload);
  }

  // Une este socket a una sala (socket.join('sala'))
  join(room: string) {
    this.server.joinRoom(this.id, room);
  }

  // Abandona una sala (socket.leave('sala'))
  leave(room: string) {
    this.server.leaveRoom(this.id, room);
  }

  get broadcast() {
    return {
      emit: (event: string, data: any) => {
        this.server.broadcast(this, event, data);
      }
    };
  }
  
  // --- ¡NUEVO MÉTODO! ---
  // Imita a socket.to('room').emit(...) para hacer broadcast a una sala
  to(room: string) {
    return {
        emit: (event: string, data: any) => {
            // Llama a un nuevo método en el servidor para manejar la lógica
            this.server.broadcastToRoom(this, room, event, data);
        }
    };
  }

  // Método interno para disparar los listeners cuando llega un mensaje
  _trigger(event: string, data: any) {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.forEach(callback => callback(data));
    }
  }
}

/**
 * El servidor principal que gestiona todos los sockets y salas.
 * Imita la instancia 'io' de Socket.IO.
 */
class BunSocketServer {
    clients: Map<string, BunSocket> = new Map();
    rooms: Map<string, Set<string>> = new Map(); // room -> Set<socket.id>
  private connectionHandler?: (socket: BunSocket) => void;

  // Escucha el evento de conexión (io.on('connection', ...))
  on(event: 'connection', handler: (socket: BunSocket) => void) {
    if (event === 'connection') {
      this.connectionHandler = handler;
    }
  }

  // Envía un mensaje a todos los clientes conectados (io.emit(...))
  emit(event: string, data: any) {
    this.clients.forEach(socket => {
        socket.emit(event, data);
    });
  }

  // Permite enviar mensajes a una sala específica (io.to('sala').emit(...))
  to(room: string) {
    return {
      emit: (event: string, data: any) => {
        if (this.rooms.has(room)) {
          this.rooms.get(room)!.forEach(socketId => {
            const client = this.clients.get(socketId);
            if (client) {
              client.emit(event, data);
            }
          });
        }
      }
    };
  }
  
  // Emite a todos menos al socket emisor
  broadcast(sender: BunSocket, event: string, data: any) {
     this.clients.forEach((client, id) => {
         if (id !== sender.id) {
             client.emit(event, data);
         }
     });
  }
    public broadcastToRoom(sender: BunSocket, room: string, event: string, data: any) {
        if (this.rooms.has(room)) {
            this.rooms.get(room)!.forEach(socketId => {
                // La condición clave: no enviar al emisor original
                if (socketId !== sender.id) {
                    const client = this.clients.get(socketId);
                    if (client) {
                        client.emit(event, data);
                    }
                }
            });
        }
    }
  // --- Métodos internos para gestionar salas ---
  joinRoom(socketId: string, room: string) {
    if (!this.rooms.has(room)) {
      this.rooms.set(room, new Set());
    }
    this.rooms.get(room)!.add(socketId);
    console.log(`Socket ${socketId} se unió a la sala ${room}`);
  }

  leaveRoom(socketId: string, room: string) {
    if (this.rooms.has(room)) {
      this.rooms.get(room)!.delete(socketId);
      if (this.rooms.get(room)!.size === 0) {
        this.rooms.delete(room);
      }
    }
     console.log(`Socket ${socketId} abandonó la sala ${room}`);
  }

  private leaveAllRooms(socketId: string) {
    this.rooms.forEach((socketIds, room) => {
      if (socketIds.has(socketId)) {
        this.leaveRoom(socketId, room);
      }
    });
  }


  // --- Manejadores para el servidor de Bun ---
  public handleOpen(ws: ServerWebSocket<WebSocketData>) {
    ws.data.id = crypto.randomUUID(); // Asignamos un ID único
    const socket = new BunSocket(ws, this);
    ws.data.socket = socket; // Guardamos la referencia
    this.clients.set(socket.id, socket);

    console.log(`Cliente conectado: ${socket.id}`);
    if (this.connectionHandler) {
      this.connectionHandler(socket);
    }
  }

  public handleMessage(ws: ServerWebSocket<WebSocketData>, message: string | Buffer) {
    try {
      // Esperamos que los mensajes sean JSON con formato { event: "...", data: ... }
      const { event, data } = JSON.parse(message.toString());
      if (event && ws.data.socket) {
        ws.data.socket._trigger(event, data);
      }
    } catch (e) {
      console.error("Error al procesar el mensaje:", e);
    }
  }

  public handleClose(ws: ServerWebSocket<WebSocketData>, code: number, reason: string) {
    const socket = ws.data.socket;
    if (socket) {
      console.log(`Cliente desconectado: ${socket.id}`);
      socket._trigger('disconnect', { code, reason });
      this.clients.delete(socket.id);
      this.leaveAllRooms(socket.id);
    }
  }
}

export const io = new BunSocketServer();