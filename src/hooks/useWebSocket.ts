import { useEffect, useRef, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { UserRole, WSServerMessage, WSClientMessage } from '../types';

export function useWebSocket(serverIp: string | null) {
  const { state, dispatch } = useAppContext();
  const { toast } = useToast();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const connect = useCallback(() => {
    if (!serverIp) return;
    
    // Default to port 3000 if not specified
    const wsUrl = `ws://${serverIp.includes(':') ? serverIp : `${serverIp}:3000`}/ws`;
    
    console.log(`Connecting to WebSocket at ${wsUrl}`);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connected');
      // Send IDENTIFY message
      if (state.session) {
        const identifyMsg: WSClientMessage = {
          type: 'IDENTIFY',
          role: state.session.role,
          judgeId: state.session.judgeId,
        };
        ws.send(JSON.stringify(identifyMsg));
      } else {
        // Default to viewer if no session yet (though we shouldn't really hit this)
        const identifyMsg: WSClientMessage = { type: 'IDENTIFY', role: UserRole.Viewer };
        ws.send(JSON.stringify(identifyMsg));
      }
    };

    ws.onmessage = (event) => {
      try {
        const data: WSServerMessage = JSON.parse(event.data);
        if (data.type === 'SYSTEM_MESSAGE') {
          toast(data.message, data.level);
        }
        dispatch({ type: 'APPLY_WS_EVENT', payload: data });
      } catch (err) {
        console.error('Failed to parse WebSocket message', err);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected. Reconnecting in 3s...');
      wsRef.current = null;
      // Auto-reconnect every 3 seconds
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
      }
      reconnectTimeoutRef.current = window.setTimeout(() => {
        connect();
      }, 3000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      ws.close();
    };

    wsRef.current = ws;

    // Start PING interval
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'PING' }));
      }
    }, 30000);

    return () => clearInterval(pingInterval);
  }, [serverIp, state.session, dispatch]);

  useEffect(() => {
    let cleanup: (() => void) | void;
    if (serverIp) {
      cleanup = connect();
    }
    
    return () => {
      if (cleanup) cleanup();
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        // Prevent onclose from attempting to reconnect when we intentionally unmount
        wsRef.current.onclose = null; 
        wsRef.current.close();
      }
    };
  }, [connect]);

  // Expose a function to send custom messages if needed (e.g., PING)
  const sendMessage = useCallback((msg: WSClientMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { sendMessage };
}
