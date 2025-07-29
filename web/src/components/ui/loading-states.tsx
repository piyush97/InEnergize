/**
 * Comprehensive Loading States Component
 * Enterprise-level loading indicators with animations and context awareness
 */

'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { 
  Loader2, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  Zap,
  Database,
  Wifi,
  WifiOff
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// ===== TYPES =====

export type LoadingSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type LoadingVariant = 'spinner' | 'pulse' | 'dots' | 'bars' | 'progress';
export type LoadingContext = 'data' | 'api' | 'auth' | 'sync' | 'upload' | 'processing' | 'generic';

export interface LoadingState {
  loading: boolean;
  progress?: number;
  message?: string;
  context?: LoadingContext;
  error?: string;
  success?: boolean;
  duration?: number;
}

// ===== BASE LOADING COMPONENT =====

export interface LoadingIndicatorProps {
  size?: LoadingSize;
  variant?: LoadingVariant;
  className?: string;
  color?: string;
  speed?: 'slow' | 'normal' | 'fast';
}

export function LoadingIndicator({
  size = 'md',
  variant = 'spinner',
  className,
  color,
  speed = 'normal',
}: LoadingIndicatorProps) {
  const sizeClasses = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
  };

  const speedClasses = {
    slow: 'animate-spin [animation-duration:2s]',
    normal: 'animate-spin',
    fast: 'animate-spin [animation-duration:0.5s]',
  };

  const colorClass = color || 'text-primary';

  switch (variant) {
    case 'spinner':
      return (
        <Loader2 
          className={cn(
            sizeClasses[size],
            speedClasses[speed],
            colorClass,
            className
          )}
        />
      );

    case 'pulse':
      return (
        <div 
          className={cn(
            sizeClasses[size],
            'animate-pulse rounded-full bg-current',
            colorClass,
            className
          )}
        />
      );

    case 'dots':
      return (
        <div className={cn('flex space-x-1', className)}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={cn(
                'w-2 h-2 rounded-full bg-current animate-bounce',
                colorClass
              )}
              style={{
                animationDelay: `${i * 0.15}s`,
                animationDuration: '0.6s',
              }}
            />
          ))}
        </div>
      );

    case 'bars':
      return (
        <div className={cn('flex space-x-1', className)}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={cn(
                'w-1 bg-current animate-pulse',
                sizeClasses[size].replace('w-', 'h-'),
                colorClass
              )}
              style={{
                animationDelay: `${i * 0.1}s`,
                animationDuration: '1.2s',
              }}
            />
          ))}
        </div>
      );

    default:
      return (
        <Loader2 
          className={cn(
            sizeClasses[size],
            speedClasses[speed],
            colorClass,
            className
          )}
        />
      );
  }
}

// ===== CONTEXTUAL LOADING COMPONENT =====

export interface ContextualLoadingProps extends LoadingState {
  className?: string;
  size?: LoadingSize;
  variant?: LoadingVariant;
  showMessage?: boolean;
  showProgress?: boolean;
  compact?: boolean;
}

export function ContextualLoading({
  loading,
  progress,
  message,
  context = 'generic',
  error,
  success,
  duration,
  className,
  size = 'md',
  variant = 'spinner',
  showMessage = true,
  showProgress = true,
  compact = false,
}: ContextualLoadingProps) {
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    if (!loading) {
      setElapsedTime(0);
      return;
    }

    const interval = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [loading]);

  const getContextConfig = () => {
    const configs = {
      data: {
        icon: Database,
        color: 'text-blue-600',
        defaultMessage: 'Loading data...',
        successMessage: 'Data loaded successfully',
      },
      api: {
        icon: Wifi,
        color: 'text-green-600',
        defaultMessage: 'Connecting to server...',
        successMessage: 'Connected successfully',
      },
      auth: {
        icon: CheckCircle,
        color: 'text-purple-600',
        defaultMessage: 'Authenticating...',
        successMessage: 'Authentication successful',
      },
      sync: {
        icon: RefreshCw,
        color: 'text-orange-600',
        defaultMessage: 'Syncing data...',
        successMessage: 'Sync completed',
      },
      upload: {
        icon: Zap,
        color: 'text-indigo-600',
        defaultMessage: 'Uploading...',
        successMessage: 'Upload completed',
      },
      processing: {
        icon: Loader2,
        color: 'text-yellow-600',
        defaultMessage: 'Processing...',
        successMessage: 'Processing completed',
      },
      generic: {
        icon: Loader2,
        color: 'text-gray-600',
        defaultMessage: 'Loading...',
        successMessage: 'Completed',
      },
    };

    return configs[context];
  };

  const config = getContextConfig();
  const displayMessage = message || config.defaultMessage;

  if (error) {
    return (
      <div className={cn('flex items-center space-x-3 text-destructive', className)}>
        <AlertCircle className={cn('flex-shrink-0', size === 'sm' ? 'w-4 h-4' : 'w-5 h-5')} />
        {showMessage && (
          <div className={compact ? '' : 'space-y-1'}>
            <p className="text-sm font-medium">Error occurred</p>
            {!compact && <p className="text-xs opacity-75">{error}</p>}
          </div>
        )}
      </div>
    );
  }

  if (success) {
    return (
      <div className={cn('flex items-center space-x-3 text-green-600', className)}>
        <CheckCircle className={cn('flex-shrink-0', size === 'sm' ? 'w-4 h-4' : 'w-5 h-5')} />
        {showMessage && (
          <div className={compact ? '' : 'space-y-1'}>
            <p className="text-sm font-medium">{config.successMessage}</p>
            {!compact && duration && (
              <p className="text-xs opacity-75">Completed in {duration}s</p>
            )}
          </div>
        )}
      </div>
    );
  }

  if (!loading) {
    return null;
  }

  return (
    <div className={cn('flex items-center space-x-3', className)}>
      <LoadingIndicator
        size={size}
        variant={variant}
        color={config.color}
        className="flex-shrink-0"
      />
      
      {showMessage && (
        <div className={compact ? 'flex items-center space-x-2' : 'space-y-1'}>
          <p className="text-sm font-medium">{displayMessage}</p>
          
          {!compact && (
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              {elapsedTime > 0 && (
                <div className="flex items-center space-x-1">
                  <Clock className="w-3 h-3" />
                  <span>{elapsedTime}s</span>
                </div>
              )}
              
              {progress !== undefined && showProgress && (
                <div className="flex items-center space-x-2">
                  <span>{Math.round(progress)}%</span>
                </div>
              )}
            </div>
          )}
          
          {progress !== undefined && showProgress && !compact && (
            <Progress value={progress} className="w-32 h-1" />
          )}
        </div>
      )}
    </div>
  );
}

// ===== LOADING OVERLAY =====

export interface LoadingOverlayProps extends ContextualLoadingProps {
  visible: boolean;
  backdrop?: boolean;
  blur?: boolean;
  zIndex?: number;
}

export function LoadingOverlay({
  visible,
  backdrop = true,
  blur = false,
  zIndex = 50,
  ...loadingProps
}: LoadingOverlayProps) {
  if (!visible) return null;

  return (
    <div 
      className={cn(
        'fixed inset-0 flex items-center justify-center',
        backdrop && 'bg-black/20',
        blur && 'backdrop-blur-sm'
      )}
      style={{ zIndex }}
    >
      <Card className="w-auto">
        <CardContent className="p-6">
          <ContextualLoading {...loadingProps} />
        </CardContent>
      </Card>
    </div>
  );
}

// ===== INLINE LOADING =====

export interface InlineLoadingProps extends ContextualLoadingProps {
  inline?: boolean;  
  position?: 'left' | 'right' | 'center';
}

export function InlineLoading({
  inline = true,
  position = 'left',
  ...loadingProps
}: InlineLoadingProps) {
  const positionClasses = {
    left: 'justify-start',
    right: 'justify-end',
    center: 'justify-center',
  };

  return (
    <div className={cn(
      'flex',
      positionClasses[position],
      inline && 'inline-flex'
    )}>
      <ContextualLoading {...loadingProps} compact />
    </div>
  );
}

// ===== SMART LOADING COMPONENT =====

export interface SmartLoadingProps {
  states: LoadingState[];
  className?: string;
  showQueue?: boolean;
  maxVisible?: number;
}

export function SmartLoading({
  states,
  className,
  showQueue = false,
  maxVisible = 3,
}: SmartLoadingProps) {
  const activeStates = states.filter(state => state.loading || state.error || state.success);
  const visibleStates = activeStates.slice(0, maxVisible);
  const queuedCount = Math.max(0, activeStates.length - maxVisible);

  if (activeStates.length === 0) return null;

  return (
    <div className={cn('space-y-2', className)}>
      {visibleStates.map((state, index) => (
        <ContextualLoading
          key={index}
          {...state}
          compact
        />
      ))}
      
      {showQueue && queuedCount > 0 && (
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <Badge variant="secondary">{queuedCount}</Badge>
          <span>more operations in queue</span>
        </div>
      )}
    </div>
  );
}

// ===== CONNECTION STATUS =====

export interface ConnectionStatusProps {
  connected: boolean;
  reconnecting?: boolean;
  className?: string;
  showLabel?: boolean;
  size?: LoadingSize;
}

export function ConnectionStatus({
  connected,
  reconnecting = false,
  className,
  showLabel = true,
  size = 'sm',
}: ConnectionStatusProps) {
  const getStatusConfig = () => {
    if (reconnecting) {
      return {
        icon: RefreshCw,
        color: 'text-orange-500',
        label: 'Reconnecting...',
        animate: true,
      };
    }
    
    if (connected) {
      return {
        icon: Wifi,
        color: 'text-green-500',
        label: 'Connected',
        animate: false,
      };
    }
    
    return {
      icon: WifiOff,
      color: 'text-red-500',
      label: 'Disconnected',
      animate: false,
    };
  };

  const config = getStatusConfig();
  const Icon = config.icon;
  
  const sizeClasses = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
    xl: 'w-8 h-8',
  };

  return (
    <div className={cn('flex items-center space-x-2', className)}>
      <Icon 
        className={cn(
          sizeClasses[size],
          config.color,
          config.animate && 'animate-spin'
        )}
      />
      {showLabel && (
        <span className={cn('text-sm', config.color)}>
          {config.label}
        </span>
      )}
    </div>
  );
}

// ===== PROGRESS LOADING =====

export interface ProgressLoadingProps {
  progress: number;
  message?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showPercentage?: boolean;
  color?: string;
}

export function ProgressLoading({
  progress,
  message,
  className,
  size = 'md',
  showPercentage = true,
  color,
}: ProgressLoadingProps) {
  const sizeClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  return (
    <div className={cn('space-y-2', className)}>
      {message && (
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">{message}</span>
          {showPercentage && (
            <span className="text-sm text-muted-foreground">
              {Math.round(progress)}%
            </span>
          )}
        </div>
      )}
      
      <Progress 
        value={progress} 
        className={cn(sizeClasses[size])}
      />
    </div>
  );
}

// ===== LOADING BUTTON =====

export interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  children: React.ReactNode;
}

export function LoadingButton({
  loading = false,
  loadingText,
  children,
  disabled,
  className,
  ...props
}: LoadingButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center space-x-2',
        'px-4 py-2 rounded-md font-medium transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-offset-2',
        disabled || loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <LoadingIndicator size="sm" />}
      <span>{loading && loadingText ? loadingText : children}</span>
    </button>
  );
}

export default ContextualLoading;