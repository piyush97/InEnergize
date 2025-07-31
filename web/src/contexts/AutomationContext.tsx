"use client";

import React, { createContext, useContext, useReducer, useEffect, useCallback, useMemo } from 'react';
import { useOptimizedWebSocket } from '@/hooks/useOptimizedWebSocket';
import { 
  AutomationOverview,
  SafetyStatus,
  QueueItem,
  MessageTemplate,
  AutomationSettings,
  AutomationEvent,
  ScheduleConnectionRequest,
  ScheduleEngagementRequest
} from '@/types/automation';

// State interfaces
interface AutomationState {
  overview: AutomationOverview | null;
  safetyStatus: SafetyStatus | null;
  queueItems: QueueItem[];
  templates: MessageTemplate[];
  settings: AutomationSettings | null;
  isLoading: boolean;
  error: string | null;
  lastUpdate: Date | null;
  connectionHealth: {
    score: number;
    status: 'excellent' | 'good' | 'fair' | 'poor';
    latency: number;
  };
}

// Action types
type AutomationAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'UPDATE_OVERVIEW'; payload: AutomationOverview }
  | { type: 'UPDATE_SAFETY_STATUS'; payload: SafetyStatus }
  | { type: 'UPDATE_QUEUE_ITEMS'; payload: QueueItem[] }
  | { type: 'UPDATE_TEMPLATES'; payload: MessageTemplate[] }
  | { type: 'UPDATE_SETTINGS'; payload: AutomationSettings }
  | { type: 'UPDATE_CONNECTION_HEALTH'; payload: { score: number; status: string; latency: number } }
  | { type: 'SET_LAST_UPDATE'; payload: Date }
  | { type: 'EMERGENCY_STOP' }
  | { type: 'RESUME_AUTOMATION' };

// Context interfaces
interface AutomationContextType extends AutomationState {
  // Actions
  scheduleConnection: (request: ScheduleConnectionRequest) => Promise<void>;
  scheduleEngagement: (request: ScheduleEngagementRequest) => Promise<void>;
  emergencyStop: () => Promise<void>;
  resumeAutomation: () => Promise<void>;
  updateTemplate: (templateId: string, updates: Partial<MessageTemplate>) => Promise<void>;
  updateSettings: (settings: Partial<AutomationSettings>) => Promise<void>;
  acknowledgeAlert: (alertId: string) => Promise<void>;
  
  // Queue management
  reorderQueueItems: (itemIds: string[]) => Promise<void>;
  cancelQueueItem: (itemId: string) => Promise<void>;
  retryQueueItem: (itemId: string) => Promise<void>;
  bulkQueueAction: (action: string, itemIds: string[]) => Promise<void>;
  
  // WebSocket status
  isConnected: boolean;
  connectionLatency: number;
  subscribeToChannel: (channel: string) => void;
  unsubscribeFromChannel: (channel: string) => void;
}

// Initial state
const initialState: AutomationState = {
  overview: null,
  safetyStatus: null,
  queueItems: [],
  templates: [],
  settings: null,
  isLoading: true,
  error: null,
  lastUpdate: null,
  connectionHealth: {
    score: 0,
    status: 'poor',
    latency: 0,
  },
};

// Reducer
function automationReducer(state: AutomationState, action: AutomationAction): AutomationState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
    
    case 'UPDATE_OVERVIEW':
      return { 
        ...state, 
        overview: action.payload, 
        isLoading: false,
        error: null,
        lastUpdate: new Date(),
      };
    
    case 'UPDATE_SAFETY_STATUS':
      return { 
        ...state, 
        safetyStatus: action.payload,
        connectionHealth: {
          ...state.connectionHealth,
          score: action.payload.score,
          status: action.payload.score >= 80 ? 'excellent' : 
                  action.payload.score >= 60 ? 'good' : 
                  action.payload.score >= 40 ? 'fair' : 'poor',
        },
        lastUpdate: new Date(),
      };
    
    case 'UPDATE_QUEUE_ITEMS':
      return { 
        ...state, 
        queueItems: action.payload.sort((a, b) => {
          // Sort by priority (high > medium > low) then by scheduledAt
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
          if (priorityDiff !== 0) return priorityDiff;
          return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
        }),
        lastUpdate: new Date(),
      };
    
    case 'UPDATE_TEMPLATES':
      return { 
        ...state, 
        templates: action.payload.sort((a, b) => (b.successRate || 0) - (a.successRate || 0)),
        lastUpdate: new Date(),
      };
    
    case 'UPDATE_SETTINGS':
      return { 
        ...state, 
        settings: action.payload,
        lastUpdate: new Date(),
      };
    
    case 'UPDATE_CONNECTION_HEALTH':
      return {
        ...state,
        connectionHealth: {
          score: action.payload.score,
          status: action.payload.status as 'excellent' | 'good' | 'fair' | 'poor',
          latency: action.payload.latency,
        },
      };
    
    case 'SET_LAST_UPDATE':
      return { ...state, lastUpdate: action.payload };
    
    case 'EMERGENCY_STOP':
      return {
        ...state,
        overview: state.overview ? {
          ...state.overview,
          automation: {
            ...state.overview.automation,
            enabled: false,
            suspended: true,
            suspensionReason: 'Emergency stop activated',
          },
        } : null,
        lastUpdate: new Date(),
      };
    
    case 'RESUME_AUTOMATION':
      return {
        ...state,
        overview: state.overview ? {
          ...state.overview,
          automation: {
            ...state.overview.automation,
            enabled: true,
            suspended: false,
            suspensionReason: undefined,
          },
        } : null,
        lastUpdate: new Date(),
      };
    
    default:
      return state;
  }
}

// Context creation
const AutomationContext = createContext<AutomationContextType | undefined>(undefined);

// Provider component
interface AutomationProviderProps {
  children: React.ReactNode;
  userId: string;
  subscriptionTier: 'free' | 'premium' | 'enterprise';
}

export function AutomationProvider({ children, userId, subscriptionTier }: AutomationProviderProps) {
  const [state, dispatch] = useReducer(automationReducer, initialState);

  // WebSocket configuration based on subscription tier
  const wsConfig = useMemo(() => ({
    url: `${process.env.NODE_ENV === 'production' ? 'wss:' : 'ws:'}//${window.location.hostname}:3007/automation/${userId}`,
    reconnect: true,
    reconnectAttempts: subscriptionTier === 'enterprise' ? 10 : 5,
    reconnectInterval: subscriptionTier === 'enterprise' ? 1000 : 3000,
    heartbeatInterval: subscriptionTier === 'enterprise' ? 15000 : 30000,
    debug: process.env.NODE_ENV === 'development',
  }), [userId, subscriptionTier]);

  // WebSocket connection
  const {
    isConnected,
    latency,
    sendMessage,
    subscribeToChannel,
    unsubscribeFromChannel,
  } = useOptimizedWebSocket({
    ...wsConfig,
    onMessage: (data: unknown) => {
      handleWebSocketMessage(data as AutomationEvent);
    },
    onOpen: () => {
      console.log('Automation WebSocket connected');
      // Subscribe to user-specific channels
      subscribeToChannel(`automation:${userId}`);
      subscribeToChannel(`safety:${userId}`);
      subscribeToChannel(`queue:${userId}`);
    },
    onError: (error) => {
      console.error('Automation WebSocket error:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Real-time connection lost' });
    },
  });

  // WebSocket message handler
  const handleWebSocketMessage = useCallback((data: AutomationEvent) => {
    switch ((data as any).type) {
      case 'overview_update':
        dispatch({ type: 'UPDATE_OVERVIEW', payload: data.data as AutomationOverview });
        break;
      
      case 'safety_update':
        dispatch({ type: 'UPDATE_SAFETY_STATUS', payload: data.data as SafetyStatus });
        break;
      
      case 'queue_update':
        dispatch({ type: 'UPDATE_QUEUE_ITEMS', payload: data.data as QueueItem[] });
        break;
      
      case 'template_update':
        dispatch({ type: 'UPDATE_TEMPLATES', payload: data.data as MessageTemplate[] });
        break;
      
      case 'settings_update':
        dispatch({ type: 'UPDATE_SETTINGS', payload: data.data as AutomationSettings });
        break;
      
      case 'health_update':
        dispatch({ 
          type: 'UPDATE_CONNECTION_HEALTH', 
          payload: data.data as { score: number; status: string; latency: number }
        });
        break;
      
      case 'automation_alert':
        // Handle critical alerts
        console.warn('Automation Alert:', data.data);
        break;
      
      default:
        console.log('Unknown WebSocket message type:', data.type);
    }
  }, []);

  // API call wrapper with error handling
  const apiCall = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    try {
      const response = await fetch(`/api/automation${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`API call failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'API call failed';
      dispatch({ type: 'SET_ERROR', payload: message });
      throw error;
    }
  }, []);

  // Action implementations
  const scheduleConnection = useCallback(async (request: any) => {
    await apiCall('/connections/schedule', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }, [apiCall]);

  const scheduleEngagement = useCallback(async (request: any) => {
    await apiCall('/engagement/schedule', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }, [apiCall]);

  const emergencyStop = useCallback(async () => {
    await apiCall('/emergency-stop', { method: 'POST' });
    dispatch({ type: 'EMERGENCY_STOP' });
  }, [apiCall]);

  const resumeAutomation = useCallback(async () => {
    await apiCall('/resume', { method: 'POST' });
    dispatch({ type: 'RESUME_AUTOMATION' });
  }, [apiCall]);

  const updateTemplate = useCallback(async (templateId: string, updates: Partial<MessageTemplate>) => {
    await apiCall(`/templates/${templateId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }, [apiCall]);

  const updateSettings = useCallback(async (settings: Partial<AutomationSettings>) => {
    await apiCall('/settings', {
      method: 'PATCH',
      body: JSON.stringify(settings),
    });
  }, [apiCall]);

  const acknowledgeAlert = useCallback(async (alertId: string) => {
    await apiCall(`/alerts/${alertId}/acknowledge`, { method: 'POST' });
  }, [apiCall]);

  // Queue management actions
  const reorderQueueItems = useCallback(async (itemIds: string[]) => {
    await apiCall('/queue/reorder', {
      method: 'POST',
      body: JSON.stringify({ itemIds }),
    });
  }, [apiCall]);

  const cancelQueueItem = useCallback(async (itemId: string) => {
    await apiCall(`/queue/${itemId}/cancel`, { method: 'POST' });
  }, [apiCall]);

  const retryQueueItem = useCallback(async (itemId: string) => {
    await apiCall(`/queue/${itemId}/retry`, { method: 'POST' });
  }, [apiCall]);

  const bulkQueueAction = useCallback(async (action: string, itemIds: string[]) => {
    await apiCall('/queue/bulk', {
      method: 'POST',
      body: JSON.stringify({ action, itemIds }),
    });
  }, [apiCall]);

  // Initial data loading
  useEffect(() => {
    const loadInitialData = async () => {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      try {
        const [overview, safetyStatus, queueItems, templates, settings] = await Promise.all([
          apiCall('/overview'),
          apiCall('/safety/status'),
          apiCall('/queue'),
          apiCall('/templates'),
          apiCall('/settings'),
        ]);

        dispatch({ type: 'UPDATE_OVERVIEW', payload: overview });
        dispatch({ type: 'UPDATE_SAFETY_STATUS', payload: safetyStatus });
        dispatch({ type: 'UPDATE_QUEUE_ITEMS', payload: queueItems });
        dispatch({ type: 'UPDATE_TEMPLATES', payload: templates });
        dispatch({ type: 'UPDATE_SETTINGS', payload: settings });
      } catch (error) {
        console.error('Failed to load initial automation data:', error);
      }
    };

    loadInitialData();
  }, [apiCall]);

  // Connection health monitoring
  useEffect(() => {
    dispatch({
      type: 'UPDATE_CONNECTION_HEALTH',
      payload: {
        score: isConnected ? Math.max(100 - latency / 10, 0) : 0,
        status: isConnected 
          ? latency < 100 ? 'excellent'
          : latency < 300 ? 'good'
          : latency < 500 ? 'fair'
          : 'poor'
          : 'poor',
        latency,
      },
    });
  }, [isConnected, latency]);

  // Context value
  const contextValue = useMemo<AutomationContextType>(() => ({
    ...state,
    scheduleConnection,
    scheduleEngagement,
    emergencyStop,
    resumeAutomation,
    updateTemplate,
    updateSettings,
    acknowledgeAlert,
    reorderQueueItems,
    cancelQueueItem,
    retryQueueItem,
    bulkQueueAction,
    isConnected,
    connectionLatency: latency,
    subscribeToChannel,
    unsubscribeFromChannel,
  }), [
    state,
    scheduleConnection,
    scheduleEngagement,
    emergencyStop,
    resumeAutomation,
    updateTemplate,
    updateSettings,
    acknowledgeAlert,
    reorderQueueItems,
    cancelQueueItem,
    retryQueueItem,
    bulkQueueAction,
    isConnected,
    latency,
    subscribeToChannel,
    unsubscribeFromChannel,
  ]);

  return (
    <AutomationContext.Provider value={contextValue}>
      {children}
    </AutomationContext.Provider>
  );
}

// Hook to use automation context
export function useAutomation() {
  const context = useContext(AutomationContext);
  if (context === undefined) {
    throw new Error('useAutomation must be used within an AutomationProvider');
  }
  return context;
}

// Hook for safety monitoring with compliance alerts
export function useAutomationSafety() {
  const { safetyStatus, emergencyStop, acknowledgeAlert, connectionHealth } = useAutomation();
  
  return {
    safetyStatus,
    emergencyStop,
    acknowledgeAlert,
    connectionHealth,
    isCompliant: (safetyStatus?.score || 0) >= 60,
    needsAttention: safetyStatus?.activeAlerts?.some(alert => alert.severity === 'high' || alert.severity === 'critical') || false,
    complianceLevel: (safetyStatus?.score || 0) >= 80 ? 'excellent' : 
                    (safetyStatus?.score || 0) >= 60 ? 'good' : 
                    (safetyStatus?.score || 0) >= 40 ? 'warning' : 'critical',
  };
}

// Hook for queue management
export function useAutomationQueue() {
  const { 
    queueItems, 
    reorderQueueItems, 
    cancelQueueItem, 
    retryQueueItem, 
    bulkQueueAction 
  } = useAutomation();

  const queueStats = useMemo(() => ({
    total: queueItems.length,
    pending: queueItems.filter(item => item.status === 'pending').length,
    processing: queueItems.filter(item => item.status === 'processing').length,
    failed: queueItems.filter(item => item.status === 'failed').length,
    highPriority: queueItems.filter(item => item.priority === 'high').length,
    avgRetryCount: queueItems.reduce((sum, item) => sum + item.retryCount, 0) / Math.max(queueItems.length, 1),
  }), [queueItems]);

  return {
    queueItems,
    queueStats,
    reorderQueueItems,
    cancelQueueItem,
    retryQueueItem,
    bulkQueueAction,
  };
}