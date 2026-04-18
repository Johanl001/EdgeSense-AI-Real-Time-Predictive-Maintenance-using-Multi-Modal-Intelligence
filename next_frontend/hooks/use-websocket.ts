import { useEffect, useState, useRef, useCallback } from 'react';

export function useWebSocket(url: string) {
  const [data, setData] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guard: if the hook has been unmounted, do not reconnect
  const isMounted = useRef(true);

  const clearRetry = () => {
    if (retryTimer.current !== null) {
      clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
  };

  const disconnect = useCallback(() => {
    clearRetry();
    const ws = wsRef.current;
    if (ws) {
      // Remove all handlers BEFORE closing so onclose doesn't trigger a reconnect
      ws.onopen = null;
      ws.onmessage = null;
      ws.onclose = null;
      ws.onerror = null;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      wsRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    // Never open a second socket while one is already open/connecting
    if (wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!isMounted.current) return;
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      if (!isMounted.current) return;
      try {
        const parsed = JSON.parse(event.data);
        setData(parsed);
      } catch (e) {
        console.error('Failed to parse WS message', e);
      }
    };

    ws.onclose = () => {
      if (!isMounted.current) return;
      setIsConnected(false);
      wsRef.current = null;
      // Only schedule a retry if still mounted
      retryTimer.current = setTimeout(() => {
        if (isMounted.current) connect();
      }, 2000);
    };

    ws.onerror = () => {
      // onerror is always followed by onclose — let onclose handle the retry.
      // Log a clean message instead of the raw Event object.
      console.warn('WebSocket connection error — will retry in 2s');
      // Close so onclose fires and schedules the retry
      ws.close();
    };
  }, [url]);

  useEffect(() => {
    isMounted.current = true;
    connect();

    return () => {
      // Signal that the component is gone — stop all retries and close socket
      isMounted.current = false;
      disconnect();
    };
  }, [connect, disconnect]);

  return { data, isConnected };
}