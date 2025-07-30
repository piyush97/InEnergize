"use client";

import React, { 
  createContext, 
  useContext, 
  useCallback, 
  useEffect, 
  useRef, 
  useState, 
  useMemo,
  ReactNode 
} from 'react';
import { useOptimizedWebSocket } from '@/hooks/useOptimizedWebSocket';
import { AutomationEvent } from '@/types/automation';

interface WebSocketContextType {
  isConnected: boolean;
  connectionState: 'connecting' | 'connected' | 'disconnected' | 'error';
  latency: number;
  reconnectAttempts: number;
  healthScore: number;
  lastError: string | null;
  
  // Core methods
  sendMessage: (message: any) => void;
  subscribeToChannel: (channel: string) => void;
  unsubscribeFromChannel: (channel: string) => void;
  reconnect: () => void;
  
  // Event listeners
  addEventListener: (event: string, handler: (data: any) => void) => () => void;
  removeEventListener: (event: string, handler: (data: any) => void) => void;
  
  // Performance metrics
  messagesSent: number;
  messagesReceived: number;
  averageLatency: number;
}

interface WebSocketProviderProps {
  children: ReactNode;
  userId: string;
  subscriptionTier: 'free' | 'premium' | 'enterprise';
  enablePerformanceMonitoring?: boolean;
  maxReconnectAttempts?: number;
  reconnectInterval?: number;
  heartbeatInterval?: number;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export function WebSocketProvider({
  children,
  userId,
  subscriptionTier,
  enablePerformanceMonitoring = true,
  maxReconnectAttempts,
  reconnectInterval,
  heartbeatInterval,
}: WebSocketProviderProps) {
  // Performance tracking
  const [messagesSent, setMessagesSent] = useState(0);
  const [messagesReceived, setMessagesReceived] = useState(0);
  const [latencyHistory, setLatencyHistory] = useState<number[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  
  // Event listeners registry
  const eventListenersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());
  
  // Performance metrics calculation
  const averageLatency = useMemo(() => {
    if (latencyHistory.length === 0) return 0;
    return latencyHistory.reduce((sum, latency) => sum + latency, 0) / latencyHistory.length;
  }, [latencyHistory]);

  // WebSocket configuration optimized by subscription tier
  const wsConfig = useMemo(() => ({
    url: `${process.env.NODE_ENV === 'production' ? 'wss:' : 'ws:'}//${
      typeof window !== 'undefined' ? window.location.hostname : 'localhost'
    }:3007/automation/${userId}`,
    
    // Enhanced configuration based on tier
    reconnect: true,
    reconnectAttempts: maxReconnectAttempts ?? (
      subscriptionTier === 'enterprise' ? 15 : 
      subscriptionTier === 'premium' ? 10 : 5
    ),
    reconnectInterval: reconnectInterval ?? (
      subscriptionTier === 'enterprise' ? 1000 : 
      subscriptionTier === 'premium' ? 2000 : 3000
    ),
    heartbeatInterval: heartbeatInterval ?? (
      subscriptionTier === 'enterprise' ? 15000 : 
      subscriptionTier === 'premium' ? 20000 : 30000
    ),
    
    // Performance optimizations
    binaryType: 'arraybuffer' as BinaryType,
    protocols: ['automation-v1'],
    
    // Debug in development
    debug: process.env.NODE_ENV === 'development',
  }), [userId, subscriptionTier, maxReconnectAttempts, reconnectInterval, heartbeatInterval]);

  // WebSocket connection with performance monitoring
  const {
    isConnected,
    latency,
    sendMessage: wsSendMessage,
    subscribeToChannel: wsSubscribeToChannel,
    unsubscribeFromChannel: wsUnsubscribeFromChannel,
    reconnect: wsReconnect,
  } = useOptimizedWebSocket({
    ...wsConfig,
    
    onMessage: useCallback((data: AutomationEvent) => {
      setMessagesReceived(prev => prev + 1);
      
      // Update latency history for performance monitoring
      if (enablePerformanceMonitoring && data.timestamp) {
        const messageLatency = Date.now() - new Date(data.timestamp).getTime();
        setLatencyHistory(prev => [...prev.slice(-19), messageLatency]); // Keep last 20 measurements
      }
      
      // Emit to registered event listeners
      const listeners = eventListenersRef.current.get(data.type);
      if (listeners) {
        listeners.forEach(handler => {
          try {
            handler(data);
          } catch (error) {
            console.error(`Error in WebSocket event handler for ${data.type}:`, error);
          }
        });
      }
      
      // Generic message event
      const genericListeners = eventListenersRef.current.get('message');
      if (genericListeners) {
        genericListeners.forEach(handler => {
          try {
            handler(data);
          } catch (error) {
            console.error('Error in generic WebSocket message handler:', error);
          }
        });
      }
    }, [enablePerformanceMonitoring]),
    
    onOpen: useCallback(() => {
      console.log('🔗 WebSocket connected to automation service');
      setLastError(null);
      setReconnectAttempts(0);
      
      // Auto-subscribe to essential channels
      const essentialChannels = [
        `automation:${userId}`,
        `safety:${userId}`,
        `queue:${userId}`,
        `health:${userId}`,
      ];
      
      essentialChannels.forEach(channel => {
        wsSubscribeToChannel(channel);
      });
      
      // Emit connection event
      const listeners = eventListenersRef.current.get('connected');
      if (listeners) {
        listeners.forEach(handler => handler({ userId, timestamp: new Date() }));
      }
    }, [userId, wsSubscribeToChannel]),
    
    onClose: useCallback((event) => {
      console.log('🔌 WebSocket disconnected:', event.reason);
      
      // Emit disconnection event
      const listeners = eventListenersRef.current.get('disconnected');
      if (listeners) {
        listeners.forEach(handler => handler({ 
          reason: event.reason, 
          code: event.code, 
          timestamp: new Date() 
        }));
      }
    }, []),
    
    onError: useCallback((error) => {
      const errorMessage = error instanceof Error ? error.message : 'WebSocket connection error';
      console.error('❌ WebSocket error:', errorMessage);
      setLastError(errorMessage);
      setReconnectAttempts(prev => prev + 1);
      
      // Emit error event
      const listeners = eventListenersRef.current.get('error');
      if (listeners) {
        listeners.forEach(handler => handler({ 
          error: errorMessage, 
          attempts: reconnectAttempts + 1,
          timestamp: new Date() 
        }));
      }
    }, [reconnectAttempts]),
    
    onReconnecting: useCallback(() => {
      console.log('🔄 WebSocket reconnecting...');
      setReconnectAttempts(prev => prev + 1);
      
      // Emit reconnecting event
      const listeners = eventListenersRef.current.get('reconnecting');
      if (listeners) {
        listeners.forEach(handler => handler({ 
          attempts: reconnectAttempts + 1,
          timestamp: new Date() 
        }));
      }
    }, [reconnectAttempts]),
  });

  // Enhanced sendMessage with performance tracking
  const sendMessage = useCallback((message: any) => {
    try {
      wsSendMessage(message);
      setMessagesSent(prev => prev + 1);
    } catch (error) {
      console.error('Failed to send WebSocket message:', error);
      setLastError(error instanceof Error ? error.message : 'Failed to send message');
    }
  }, [wsSendMessage]);

  // Event listener management
  const addEventListener = useCallback((event: string, handler: (data: any) => void) => {
    const eventListeners = eventListenersRef.current;
    
    if (!eventListeners.has(event)) {
      eventListeners.set(event, new Set());
    }
    
    eventListeners.get(event)!.add(handler);
    
    // Return cleanup function
    return () => {
      const listeners = eventListeners.get(event);
      if (listeners) {
        listeners.delete(handler);
        if (listeners.size === 0) {
          eventListeners.delete(event);
        }
      }
    };
  }, []);

  const removeEventListener = useCallback((event: string, handler: (data: any) => void) => {
    const listeners = eventListenersRef.current.get(event);
    if (listeners) {
      listeners.delete(handler);
      if (listeners.size === 0) {
        eventListenersRef.current.delete(event);
      }
    }
  }, []);

  // Connection state calculation
  const connectionState = useMemo(() => {
    if (lastError) return 'error';
    if (isConnected) return 'connected';
    if (reconnectAttempts > 0) return 'connecting';
    return 'disconnected';
  }, [isConnected, lastError, reconnectAttempts]);

  // Health score calculation (0-100)
  const healthScore = useMemo(() => {
    if (!isConnected) return 0;
    
    let score = 100;
    
    // Deduct points for high latency
    if (latency > 1000) score -= 30;
    else if (latency > 500) score -= 20;
    else if (latency > 200) score -= 10;
    
    // Deduct points for reconnection attempts
    score -= Math.min(reconnectAttempts * 5, 25);
    
    // Deduct points for recent errors
    if (lastError) score -= 15;
    
    // Bonus for enterprise tier stability
    if (subscriptionTier === 'enterprise' && reconnectAttempts === 0) {
      score = Math.min(score + 5, 100);
    }
    
    return Math.max(score, 0);
  }, [isConnected, latency, reconnectAttempts, lastError, subscriptionTier]);

  // Context value with memoization for performance
  const contextValue = useMemo<WebSocketContextType>(() => ({
    isConnected,
    connectionState,
    latency,
    reconnectAttempts,
    healthScore,
    lastError,
    
    sendMessage,
    subscribeToChannel: wsSubscribeToChannel,
    unsubscribeFromChannel: wsUnsubscribeFromChannel,
    reconnect: wsReconnect,
    
    addEventListener,
    removeEventListener,
    
    messagesSent,
    messagesReceived,
    averageLatency,
  }), [
    isConnected,
    connectionState,
    latency,
    reconnectAttempts,
    healthScore,
    lastError,
    sendMessage,
    wsSubscribeToChannel,
    wsUnsubscribeFromChannel,
    wsReconnect,
    addEventListener,
    removeEventListener,
    messagesSent,
    messagesReceived,
    averageLatency,
  ]);

  // Performance monitoring effect
  useEffect(() => {
    if (!enablePerformanceMonitoring) return;

    const interval = setInterval(() => {
      // Log performance metrics in development
      if (process.env.NODE_ENV === 'development') {
        console.log('📊 WebSocket Performance:', {
          isConnected,
          healthScore,
          latency,
          averageLatency,
          messagesSent,
          messagesReceived,
          reconnectAttempts,
        });
      }
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [
    enablePerformanceMonitoring,
    isConnected,
    healthScore,
    latency,
    averageLatency,
    messagesSent,
    messagesReceived,
    reconnectAttempts,
  ]);

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
}

// Hook to use WebSocket context
export function useWebSocket(): WebSocketContextType {
  const context = useContext(WebSocketContext);
  
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  
  return context;
}

// Typed hook for specific event types
export function useWebSocketEvent<T = any>(
  event: string,
  handler: (data: T) => void,
  dependencies: React.DependencyList = []
) {
  const { addEventListener } = useWebSocket();
  
  useEffect(() => {
    const cleanup = addEventListener(event, handler);
    return cleanup;
  }, [addEventListener, event, ...dependencies]);
}

// Performance monitoring hook
export function useWebSocketPerformance() {
  const { 
    healthScore, 
    latency, 
    averageLatency, 
    messagesSent, 
    messagesReceived,
    reconnectAttempts,
    connectionState 
  } = useWebSocket();
  
  return {
    healthScore,
    latency,
    averageLatency,
    messagesSent,
    messagesReceived,
    reconnectAttempts,
    connectionState,
    throughput: messagesSent + messagesReceived,
    efficiency: messagesReceived > 0 ? (messagesReceived / (messagesSent + messagesReceived)) * 100 : 0,
  };
}