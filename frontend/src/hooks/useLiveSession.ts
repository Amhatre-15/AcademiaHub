import { useState, useEffect, useCallback, useRef } from 'react';

const WS_URL = import.meta.env.VITE_WS_URL || (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/^http/, 'ws');

export function useLiveSession(sessionId?: string) {
  // Use a ref for the WebSocket instance — it's an external resource, not React state
  const socketRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<any>(null);

  useEffect(() => {
    if (!sessionId) return;

    const token = localStorage.getItem('auth_token');
    if (!token) return;

    // Connect to WebSocket server
    const ws = new WebSocket(`${WS_URL}?token=${token}`);
    socketRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      // Join the session room
      ws.send(JSON.stringify({ action: 'join_session', sessionId }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLastMessage(data);
      } catch (e) {
        console.error('Error parsing WS message:', e);
      }
    };

    ws.onclose = () => {
      setConnected(false);
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: 'leave_session', sessionId }));
        ws.close();
      }
      socketRef.current = null;
    };
  }, [sessionId]);

  const sendMessage = useCallback((msg: any) => {
    const ws = socketRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  return { connected, lastMessage, sendMessage };
}
