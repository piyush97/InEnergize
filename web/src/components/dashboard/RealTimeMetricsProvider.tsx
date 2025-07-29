// RealTimeMetricsProvider.tsx - WebSocket Provider for Real-time LinkedIn Metrics
// Manages WebSocket connections for live dashboard updates with LinkedIn compliance
// Provides real-time data updates while respecting API rate limits

'use client';

import React, { createContext, useContext, useEffect, useState, useRef, ReactNode, useCallback } from 'react';

// Types for real-time metrics data
interface RealTimeMetrics {
  profileViews: number;
  searchAppearances: number;
  connections: number;
  completenessScore: number;
  engagementRate: number;
  lastUpdated: string;
  complianceStatus: 'good' | 'warning' | 'critical' | 'unknown';
  rateLimitStatus: {
    remaining: number;
    limit: number;
    resetTime: string;
  } | null;
}

interface RealTimeUpdate {
  type: 'metrics_update' | 'compliance_alert' | 'rate_limit_warning' | 'connection_status';
  data: unknown;
  timestamp: string;
}

interface WebSocketConnection {
  isConnected: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  lastError?: string;
  reconnectAttempts: number;
  metrics: RealTimeMetrics | null;
  subscribe: (callback: (update: RealTimeUpdate) => void) => () => void;
  sendMessage: (message: unknown) => void;
}

interface RealTimeMetricsProviderProps {
  children: ReactNode;
  enableWebSocket?: boolean;
  enableFallbackPolling?: boolean;
  pollingInterval?: number;
  maxReconnectAttempts?: number;
}

// Create context
const RealTimeMetricsContext = createContext<WebSocketConnection | null>(null);

// Custom hook to use the context
export const useRealTimeMetrics = () => {
  const context = useContext(RealTimeMetricsContext);
  if (!context) {
    throw new Error('useRealTimeMetrics must be used within a RealTimeMetricsProvider');
  }
  return context;
};

// WebSocket Provider Component
export const RealTimeMetricsProvider: React.FC<RealTimeMetricsProviderProps> = ({
  children,
  enableWebSocket = true,
  enableFallbackPolling = true,
  pollingInterval = 30000, // 30 seconds
  maxReconnectAttempts = 5
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [lastError, setLastError] = useState<string | undefined>();
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [metrics, setMetrics] = useState<RealTimeMetrics | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const subscribersRef = useRef<Set<(update: RealTimeUpdate) => void>>(new Set());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize connection on mount
  useEffect(() => {
    if (enableWebSocket) {
      initializeWebSocket();
    } else if (enableFallbackPolling) {
      startPolling();
    }

    return () => {
      cleanup();
    };
  }, [enableWebSocket, enableFallbackPolling]);

  const cleanup = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }
  };

  const initializeWebSocket = useCallback(async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        console.warn('No auth token available for WebSocket connection');
        if (enableFallbackPolling) {
          startPolling();
        }
        return;
      }

      setConnectionStatus('connecting');
      setLastError(undefined);

      // In a real implementation, this would connect to your WebSocket server
      // For now, we'll create a mock WebSocket connection
      const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/v1/ws/metrics`;
      
      // Mock WebSocket for development
      if (process.env.NODE_ENV === 'development') {
        createMockWebSocket();
        return;
      }

      const ws = new WebSocket(`${wsUrl}?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setConnectionStatus('connected');
        setReconnectAttempts(0);
        setLastError(undefined);
        
        // Start heartbeat
        startHeartbeat();
        
        // Request initial metrics
        sendMessage({ type: 'get_metrics' });
        
        notifySubscribers({
          type: 'connection_status',
          data: { status: 'connected' },
          timestamp: new Date().toISOString()
        });
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        setIsConnected(false);
        setConnectionStatus('disconnected');
        
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
        }
        
        notifySubscribers({
          type: 'connection_status',
          data: { status: 'disconnected', code: event.code, reason: event.reason },
          timestamp: new Date().toISOString()
        });

        // Attempt to reconnect if not a manual close
        if (event.code !== 1000 && reconnectAttempts < maxReconnectAttempts) {
          scheduleReconnect();
        } else if (enableFallbackPolling) {
          startPolling();
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('error');
        setLastError('WebSocket connection error');
        
        notifySubscribers({
          type: 'connection_status',
          data: { status: 'error', error: 'Connection error' },
          timestamp: new Date().toISOString()
        });
      };

    } catch (err) {
      console.error('Failed to initialize WebSocket:', err);
      setConnectionStatus('error');
      setLastError(err instanceof Error ? err.message : 'Unknown error');
      
      if (enableFallbackPolling) {
        startPolling();
      }
    }
  }, [enableFallbackPolling, maxReconnectAttempts, reconnectAttempts]);

  const createMockWebSocket = () => {
    // Mock WebSocket for development
    setIsConnected(true);
    setConnectionStatus('connected');
    setReconnectAttempts(0);

    // Simulate real-time updates
    const mockInterval = setInterval(() => {
      const mockMetrics: RealTimeMetrics = {
        profileViews: Math.floor(Math.random() * 1000) + 500,
        searchAppearances: Math.floor(Math.random() * 100) + 50,
        connections: Math.floor(Math.random() * 500) + 200,
        completenessScore: Math.floor(Math.random() * 20) + 75,
        engagementRate: Math.random() * 10 + 2,
        lastUpdated: new Date().toISOString(),
        complianceStatus: 'good',
        rateLimitStatus: {
          remaining: Math.floor(Math.random() * 100) + 50,
          limit: 200,
          resetTime: new Date(Date.now() + 3600000).toISOString()
        }
      };

      setMetrics(mockMetrics);
      notifySubscribers({
        type: 'metrics_update',
        data: mockMetrics,
        timestamp: new Date().toISOString()
      });
    }, 5000); // Update every 5 seconds in development

    // Cleanup function
    return () => clearInterval(mockInterval);
  };

  const handleWebSocketMessage = (data: { type: string; payload?: unknown }) => {
    switch (data.type) {
      case 'metrics_update':
        setMetrics(data.payload as RealTimeMetrics);
        notifySubscribers({
          type: 'metrics_update',
          data: data.payload,
          timestamp: new Date().toISOString()
        });
        break;
        
      case 'compliance_alert':
        notifySubscribers({
          type: 'compliance_alert',
          data: data.payload,
          timestamp: new Date().toISOString()
        });
        break;
        
      case 'rate_limit_warning':
        notifySubscribers({
          type: 'rate_limit_warning',
          data: data.payload,
          timestamp: new Date().toISOString()
        });
        break;
        
      case 'pong':
        // Heartbeat response
        break;
        
      default:
        console.log('Unknown WebSocket message type:', data.type);
    }
  };

  const startHeartbeat = () => {
    heartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        sendMessage({ type: 'ping' });
      }
    }, 30000); // Send ping every 30 seconds
  };

  const scheduleReconnect = () => {
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000); // Exponential backoff, max 30s
    
    reconnectTimeoutRef.current = setTimeout(() => {
      setReconnectAttempts(prev => prev + 1);
      initializeWebSocket();
    }, delay);
  };

  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    // Initial fetch
    fetchMetricsViaHTTP();

    // Set up polling
    pollingIntervalRef.current = setInterval(() => {
      fetchMetricsViaHTTP();
    }, pollingInterval);
  }, [pollingInterval]);

  const fetchMetricsViaHTTP = async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return;

      const response = await fetch('/api/v1/metrics/realtime', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setMetrics(data.data);
        notifySubscribers({
          type: 'metrics_update',
          data: data.data,
          timestamp: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error('Failed to fetch metrics via HTTP:', err);
    }
  };

  const notifySubscribers = (update: RealTimeUpdate) => {
    subscribersRef.current.forEach(callback => {
      try {
        callback(update);
      } catch (err) {
        console.error('Error in subscriber callback:', err);
      }
    });
  };

  const subscribe = (callback: (update: RealTimeUpdate) => void) => {
    subscribersRef.current.add(callback);
    
    // Return unsubscribe function
    return () => {
      subscribersRef.current.delete(callback);
    };
  };

  const sendMessage = (message: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  };

  const contextValue: WebSocketConnection = {
    isConnected,
    connectionStatus,
    lastError,
    reconnectAttempts,
    metrics,
    subscribe,
    sendMessage
  };

  return (
    <RealTimeMetricsContext.Provider value={contextValue}>
      {children}
    </RealTimeMetricsContext.Provider>
  );
};

// Helper hook for connection status
export const useConnectionStatus = () => {
  const { isConnected, connectionStatus, lastError, reconnectAttempts } = useRealTimeMetrics();
  return { isConnected, connectionStatus, lastError, reconnectAttempts };
};

// Helper hook for metrics subscription
export const useMetricsSubscription = (callback: (update: RealTimeUpdate) => void) => {
  const { subscribe } = useRealTimeMetrics();
  
  useEffect(() => {
    const unsubscribe = subscribe(callback);
    return unsubscribe;
  }, [callback, subscribe]);
};

export default RealTimeMetricsProvider;