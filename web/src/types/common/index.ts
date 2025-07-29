/**
 * Common TypeScript types for InErgize frontend application
 * Enterprise-level type definitions with strict type safety
 */

// API Response types with strict error handling
export interface ApiResponse<TData = unknown> {
  success: boolean;
  data: TData;
  message?: string;
  timestamp: string;
  requestId: string;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    stack?: string; // Only in development
  };
  timestamp: string;
  requestId: string;
}

// Async operation states with loading indicators
export interface AsyncState<TData = unknown> {
  data: TData | null;
  loading: boolean;
  error: string | null;
  lastFetch?: Date;
  retryCount?: number;
}

// Real-time connection status
export interface ConnectionStatus {
  connected: boolean;
  reconnecting: boolean;
  connectionId?: string;
  lastConnected?: Date;
  errorCount: number;
}

// Pagination types
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<TData = unknown> {
  items: TData[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

// Component prop base types
export interface BaseComponentProps {
  className?: string;
  'data-testid'?: string;
}

export interface LoadingComponentProps extends BaseComponentProps {
  loading?: boolean;
  skeleton?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

// Error boundary types
export interface ErrorInfo {
  componentStack: string;
  errorBoundary?: string;
}

export interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
  errorInfo?: ErrorInfo;
}

// WebSocket message types
export interface WebSocketMessage<TPayload = unknown> {
  type: string;
  payload: TPayload;
  timestamp: string;
  id: string;
}

export interface WebSocketConnectionConfig {
  url: string;
  protocols?: string[];
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  timeout?: number;
}

// Time range types for analytics
export type TimeRange = '1h' | '6h' | '24h' | '7d' | '30d' | '90d' | '1y';

export interface TimeRangeConfig {
  value: TimeRange;
  label: string;
  granularity: 'minute' | 'hour' | 'day' | 'week' | 'month';
}

// Theme and design system types
export type ColorScheme = 'light' | 'dark' | 'system';
export type ComponentSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type ComponentVariant = 'default' | 'primary' | 'secondary' | 'destructive' | 'outline' | 'ghost';

// Accessibility types
export interface AccessibilityProps {
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-expanded'?: boolean;
  'aria-selected'?: boolean;
  'aria-disabled'?: boolean;
  role?: string;
  tabIndex?: number;
}

// Form and validation types
export interface FormFieldError {
  message: string;
  code: string;
  field: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: FormFieldError[];
}

// Performance monitoring types
export interface PerformanceMetrics {
  loadTime: number;
  renderTime: number;
  memoryUsage?: number;
  bundleSize?: number;
  cacheHitRate?: number;
}

// User preferences and settings
export interface UserPreferences {
  theme: ColorScheme;
  language: string;
  timezone: string;
  notifications: {
    email: boolean;
    push: boolean;
    inApp: boolean;
  };
  dashboard: {
    layout: 'grid' | 'list';
    refreshInterval: number;
    showAdvancedMetrics: boolean;
  };
}

// Utility types for strict typing
export type NonEmptyArray<T> = [T, ...T[]];
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

// Brand types for ID safety
export type UserId = string & { readonly brand: unique symbol };
export type ConnectionId = string & { readonly brand: unique symbol };
export type TemplateId = string & { readonly brand: unique symbol };
export type AutomationId = string & { readonly brand: unique symbol };

// Environment types
export type Environment = 'development' | 'staging' | 'production';

export interface EnvironmentConfig {
  environment: Environment;
  apiBaseUrl: string;
  wsBaseUrl: string;
  enableDebugMode: boolean;
  enableAnalytics: boolean;
  maxRetries: number;
  requestTimeout: number;
}