// useOptimizedWebSocket.ts - High-performance WebSocket hook with reconnection and state management
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';

interface WebSocketOptions {
  url: string;
  protocols?: string | string[];
  reconnect?: boolean;
  reconnectInterval?: number;
  reconnectAttempts?: number;
  heartbeatInterval?: number;
  onOpen?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
  onMessage?: (data: unknown) => void;
  onReconnect?: (attempt: number) => void;
  debug?: boolean;
}

interface WebSocketState {
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
  reconnectAttempt: number;
  lastMessage: unknown;
  lastUpdate: Date | null;
  error: Error | null;
  latency: number;
}

interface WebSocketReturn extends WebSocketState {
  sendMessage: (data: Record<string, unknown>) => void;
  disconnect: () => void;
  reconnect: () => void;
  subscribeToChannel: (channel: string) => void;
  unsubscribeFromChannel: (channel: string) => void;
}

// Performance optimized WebSocket hook
export function useOptimizedWebSocket(options: WebSocketOptions): WebSocketReturn {
  const {
    url,
    protocols,
    reconnect = true,
    reconnectInterval = 3000,
    reconnectAttempts = 5,
    heartbeatInterval = 30000,
    onOpen,
    onClose,
    onError,
    onMessage,
    onReconnect,
    debug = false,
  } = options;

  const router = useRouter();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const latencyCheckRef = useRef<{ timestamp: number; id: string } | null>(null);
  const subscribedChannels = useRef<Set<string>>(new Set());
  const messageQueue = useRef<Record<string, unknown>[]>([]);

  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    isConnecting: false,
    isReconnecting: false,
    reconnectAttempt: 0,
    lastMessage: null,
    lastUpdate: null,
    error: null,
    latency: 0,
  });

  // Debug logging
  const log = useCallback(
    (...args: unknown[]) => {
      if (debug) {
        console.log('[WebSocket]', ...args);
      }
    },
    [debug]
  );

  // Measure latency
  const measureLatency = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const id = Math.random().toString(36).substring(7);
      latencyCheckRef.current = { timestamp: Date.now(), id };
      
      wsRef.current.send(
        JSON.stringify({
          type: 'ping',
          id,
          timestamp: Date.now(),
        })
      );
    }
  }, []);

  // Heartbeat to keep connection alive
  const startHeartbeat = useCallback(() => {
    stopHeartbeat();
    heartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'heartbeat' }));
        measureLatency();
      }
    }, heartbeatInterval);
  }, [heartbeatInterval, measureLatency]);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }
  }, []);

  // Send queued messages
  const flushMessageQueue = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN && messageQueue.current.length > 0) {
      log('Flushing message queue:', messageQueue.current.length, 'messages');
      messageQueue.current.forEach((message) => {
        wsRef.current?.send(JSON.stringify(message));
      });
      messageQueue.current = [];
    }
  }, [log]);

  // WebSocket event handlers
  const handleOpen = useCallback(
    (event: Event) => {
      log('Connected');
      setState((prev) => ({
        ...prev,
        isConnected: true,
        isConnecting: false,
        isReconnecting: false,
        reconnectAttempt: 0,
        error: null,
      }));

      // Re-subscribe to channels
      if (subscribedChannels.current.size > 0) {
        subscribedChannels.current.forEach((channel) => {
          wsRef.current?.send(
            JSON.stringify({
              type: 'subscribe',
              channel,
            })
          );
        });
      }

      startHeartbeat();
      flushMessageQueue();
      onOpen?.(event);
    },
    [onOpen, startHeartbeat, flushMessageQueue, log]
  );

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);

        // Handle pong response for latency measurement
        if (data.type === 'pong' && latencyCheckRef.current?.id === data.id && latencyCheckRef.current) {
          const latency = Date.now() - latencyCheckRef.current.timestamp;
          setState((prev) => ({ ...prev, latency }));
          latencyCheckRef.current = null;
          return;
        }

        setState((prev) => ({
          ...prev,
          lastMessage: data,
          lastUpdate: new Date(),
        }));

        onMessage?.(data);
      } catch (error) {
        log('Error parsing message:', error);
      }
    },
    [onMessage, log]
  );

  const handleError = useCallback(
    (event: Event) => {
      log('Error:', event);
      setState((prev) => ({
        ...prev,
        error: new Error('WebSocket error'),
      }));
      onError?.(event);
    },
    [onError, log]
  );

  const handleClose = useCallback(
    (event: CloseEvent) => {
      log('Disconnected:', event.code, event.reason);
      setState((prev) => ({
        ...prev,
        isConnected: false,
        isConnecting: false,
      }));

      stopHeartbeat();
      onClose?.(event);

      // Attempt reconnection if enabled
      if (
        reconnect &&
        !event.wasClean &&
        state.reconnectAttempt < reconnectAttempts
      ) {
        const attempt = state.reconnectAttempt + 1;
        setState((prev) => ({
          ...prev,
          isReconnecting: true,
          reconnectAttempt: attempt,
        }));

        log(`Reconnecting in ${reconnectInterval}ms (attempt ${attempt}/${reconnectAttempts})`);
        onReconnect?.(attempt);

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, reconnectInterval * Math.min(attempt, 3)); // Exponential backoff
      }
    },
    [
      onClose,
      reconnect,
      reconnectInterval,
      reconnectAttempts,
      state.reconnectAttempt,
      stopHeartbeat,
      onReconnect,
      log,
    ]
  );

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      log('Already connected');
      return;
    }

    log('Connecting to:', url);
    setState((prev) => ({ ...prev, isConnecting: true, error: null }));

    try {
      wsRef.current = new WebSocket(url, protocols);
      wsRef.current.onopen = handleOpen;
      wsRef.current.onmessage = handleMessage;
      wsRef.current.onerror = handleError;
      wsRef.current.onclose = handleClose;
    } catch (error) {
      log('Connection error:', error);
      setState((prev) => ({
        ...prev,
        isConnecting: false,
        error: error as Error,
      }));
    }
  }, [url, protocols, handleOpen, handleMessage, handleError, handleClose, log]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    log('Disconnecting');
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    stopHeartbeat();
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnect');
      wsRef.current = null;
    }
    
    setState((prev) => ({
      ...prev,
      isConnected: false,
      isConnecting: false,
      isReconnecting: false,
      reconnectAttempt: 0,
    }));
  }, [stopHeartbeat, log]);

  // Send message
  const sendMessage = useCallback(
    (data: unknown) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(data));
      } else {
        log('Queueing message (not connected)');
        messageQueue.current.push(data as Record<string, unknown>);
      }
    },
    [log]
  );

  // Subscribe to channel
  const subscribeToChannel = useCallback(
    (channel: string) => {
      subscribedChannels.current.add(channel);
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        sendMessage({ type: 'subscribe', channel });
      }
    },
    [sendMessage]
  );

  // Unsubscribe from channel
  const unsubscribeFromChannel = useCallback(
    (channel: string) => {
      subscribedChannels.current.delete(channel);
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        sendMessage({ type: 'unsubscribe', channel });
      }
    },
    [sendMessage]
  );

  // Manual reconnect
  const reconnectWebSocket = useCallback(() => {
    disconnect();
    setState((prev) => ({ ...prev, reconnectAttempt: 0 }));
    setTimeout(connect, 100);
  }, [disconnect, connect]);

  // Initialize connection
  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [url]); // Only reconnect on URL change

  // Clean up on route change
  useEffect(() => {
    const handleRouteChange = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        // Keep connection alive during route changes
        log('Route change detected, maintaining connection');
      }
    };

    router.events.on('routeChangeStart', handleRouteChange);
    return () => {
      router.events.off('routeChangeStart', handleRouteChange);
    };
  }, [router, log]);

  // Memoized return value
  return useMemo(
    () => ({
      ...state,
      sendMessage,
      disconnect,
      reconnect: reconnectWebSocket,
      subscribeToChannel,
      unsubscribeFromChannel,
    }),
    [state, sendMessage, disconnect, reconnectWebSocket, subscribeToChannel, unsubscribeFromChannel]
  );
}

// Typed WebSocket hook for specific message types
export function useTypedWebSocket<T = unknown>(options: WebSocketOptions) {
  const [messages, setMessages] = useState<T[]>([]);
  
  const ws = useOptimizedWebSocket({
    ...options,
    onMessage: (data: unknown) => {
      const typedData = data as T;
      setMessages((prev) => [...prev, typedData].slice(-100)); // Keep last 100 messages
      options.onMessage?.(typedData);
    },
  });

  return {
    ...ws,
    messages,
    clearMessages: () => setMessages([]),
  };
}