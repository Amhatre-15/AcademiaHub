import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

interface AuthPayload {
  userId: string;
  role: string;
}

interface WsClient extends WebSocket {
  userId?: string;
  role?: string;
  isAlive: boolean;
}

class SessionManager {
  private wss: WebSocketServer | null = null;
  // Map of sessionId -> Set of connected WebSocket clients
  private rooms = new Map<string, Set<WsClient>>();
  // Map of userId -> Set of their active WebSockets (users might have multiple tabs)
  private userSockets = new Map<string, Set<WsClient>>();

  public initialize(server: any) {
    this.wss = new WebSocketServer({ noServer: true });

    // Handle the HTTP upgrade to WebSocket
    server.on('upgrade', (request: IncomingMessage, socket: any, head: Buffer) => {
      // Very basic JWT token extraction from query parameter (e.g., ws://.../?token=XYZ)
      // Note: for production, extracting from Cookie or Auth header (if possible) is better, 
      // but query parameter is most compatible for raw WebSocket API in browsers.
      const url = new URL(request.url || '', `http://${request.headers.host}`);
      const token = url.searchParams.get('token');

      if (!token) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      try {
        const decoded = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
        
        this.wss!.handleUpgrade(request, socket, head, (ws) => {
          const client = ws as WsClient;
          client.userId = decoded.userId;
          client.role = decoded.role;
          this.wss!.emit('connection', client, request);
        });
      } catch (error) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
      }
    });

    this.wss.on('connection', (ws: WsClient) => {
      ws.isAlive = true;

      // Track user socket
      if (ws.userId) {
        if (!this.userSockets.has(ws.userId)) {
          this.userSockets.set(ws.userId, new Set());
        }
        this.userSockets.get(ws.userId)!.add(ws);
      }

      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.on('message', (message: string) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleMessage(ws, data);
        } catch (e) {
          console.error('WebSocket message parsing error:', e);
        }
      });

      ws.on('close', () => {
        this.removeClientFromAllRooms(ws);
        
        // Remove from user sockets
        if (ws.userId && this.userSockets.has(ws.userId)) {
          const userSet = this.userSockets.get(ws.userId)!;
          userSet.delete(ws);
          if (userSet.size === 0) {
            this.userSockets.delete(ws.userId);
          }
        }
      });
    });

    // Heartbeat to keep connections alive and clear dead ones
    setInterval(() => {
      this.wss?.clients.forEach((client) => {
        const ws = client as WsClient;
        if (!ws.isAlive) {
          this.removeClientFromAllRooms(ws);
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);
  }

  private handleMessage(ws: WsClient, data: any) {
    switch (data.action) {
      case 'join_session':
        if (data.sessionId) {
          this.joinRoom(data.sessionId, ws);
        }
        break;
      case 'leave_session':
        if (data.sessionId) {
          this.leaveRoom(data.sessionId, ws);
        }
        break;
      case 'whiteboard_stroke':
        // Broadcast drawing stroke to all clients in this session (excluding sender if needed, or all)
        if (data.sessionId && data.stroke) {
          this.broadcastToSession(data.sessionId, {
            type: 'WHITEBOARD_STROKE',
            stroke: data.stroke,
            senderId: ws.userId,
          });
        }
        break;
      case 'whiteboard_clear':
        if (data.sessionId) {
          this.broadcastToSession(data.sessionId, {
            type: 'WHITEBOARD_CLEAR',
            senderId: ws.userId,
          });
        }
        break;
    }
  }

  public joinRoom(sessionId: string, ws: WsClient) {
    if (!this.rooms.has(sessionId)) {
      this.rooms.set(sessionId, new Set());
    }
    this.rooms.get(sessionId)!.add(ws);
  }

  public leaveRoom(sessionId: string, ws: WsClient) {
    if (this.rooms.has(sessionId)) {
      this.rooms.get(sessionId)!.delete(ws);
      if (this.rooms.get(sessionId)!.size === 0) {
        this.rooms.delete(sessionId);
      }
    }
  }

  private removeClientFromAllRooms(ws: WsClient) {
    this.rooms.forEach((clients, sessionId) => {
      if (clients.has(ws)) {
        clients.delete(ws);
        if (clients.size === 0) {
          this.rooms.delete(sessionId);
        }
      }
    });
  }

  // Broadcast to all clients in a session
  public broadcastToSession(sessionId: string, message: any) {
    if (this.rooms.has(sessionId)) {
      // serverTime lets load tests measure real fan-out latency and lets
      // clients compensate for clock skew without a separate probe.
      const dataString = JSON.stringify({ ...message, serverTime: Date.now() });
      this.rooms.get(sessionId)!.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(dataString);
        }
      });
    }
  }
}

export const sessionManager = new SessionManager();
