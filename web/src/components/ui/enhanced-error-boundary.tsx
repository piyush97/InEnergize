/**
 * Enhanced Error Boundary with comprehensive error handling
 * Enterprise-level error boundaries with logging, recovery, and user feedback
 */

'use client';

import React, { Component, ComponentType, ErrorInfo, ReactNode, Suspense } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  AlertTriangle, 
  RefreshCw, 
  Bug, 
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Copy,
  CheckCircle 
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
  retryCount: number;
  showDetails: boolean;
  reportSent: boolean;
}

interface EnhancedErrorBoundaryProps {
  children: ReactNode;
  fallback?: ComponentType<ErrorFallbackProps>;
  onError?: (error: Error, errorInfo: ErrorInfo, errorId: string) => void;
  enableReporting?: boolean;
  maxRetries?: number;
  resetOnPropsChange?: boolean;
  level?: 'page' | 'section' | 'component';
  className?: string;
  title?: string;
  description?: string;
}

interface ErrorFallbackProps {
  error: Error;
  errorInfo: ErrorInfo | null;
  resetError: () => void;
  retryCount: number;
  maxRetries: number;
  errorId: string;
  onReport?: () => void;
  level: 'page' | 'section' | 'component';
}

export class EnhancedErrorBoundary extends Component<
  EnhancedErrorBoundaryProps,
  ErrorBoundaryState
> {
  private resetTimeoutId: number | null = null;

  constructor(props: EnhancedErrorBoundaryProps) {
    super(props);
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
      retryCount: 0,
      showDetails: false,
      reportSent: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      hasError: true,
      error,
      errorId,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError, enableReporting = true } = this.props;
    const { errorId } = this.state;

    // Update state with error info
    this.setState({ errorInfo });

    // Call custom error handler
    if (onError) {
      onError(error, errorInfo, errorId);
    }

    // Log error with context
    this.logError(error, errorInfo, errorId);

    // Send error report if enabled
    if (enableReporting) {
      this.sendErrorReport(error, errorInfo, errorId);
    }
  }

  componentDidUpdate(prevProps: EnhancedErrorBoundaryProps) {
    const { resetOnPropsChange = false, children } = this.props;
    const { hasError } = this.state;

    // Reset error boundary if props changed and resetOnPropsChange is enabled
    if (hasError && resetOnPropsChange && prevProps.children !== children) {
      this.resetError();
    }
  }

  private logError = (error: Error, errorInfo: ErrorInfo, errorId: string) => {
    const logData = {
      errorId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: localStorage.getItem('userId'),
      level: this.props.level || 'component',
    };

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.group(`🚨 Error Boundary Caught Error [${errorId}]`);
      console.error('Error:', error);
      console.error('Error Info:', errorInfo);
      console.table(logData);
      console.groupEnd();
    }

    // Send to logging service in production
    if (process.env.NODE_ENV === 'production') {
      this.sendToLoggingService(logData);
    }
  };

  private sendToLoggingService = async (logData: Record<string, unknown>) => {
    try {
      await fetch('/api/v1/errors/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify(logData),
      });
    } catch (error) {
      console.error('Failed to send error log:', error);
    }
  };

  private sendErrorReport = async (error: Error, errorInfo: ErrorInfo, errorId: string) => {
    try {
      const reportData = {
        errorId,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
        errorInfo: {
          componentStack: errorInfo.componentStack,
        },
        context: {
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href,
          userId: localStorage.getItem('userId'),
          level: this.props.level || 'component',
        },
      };

      const response = await fetch('/api/v1/errors/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify(reportData),
      });

      if (response.ok) {
        this.setState({ reportSent: true });
      }
    } catch (error) {
      console.error('Failed to send error report:', error);
    }
  };

  private resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
      showDetails: false,
      reportSent: false,
    });
  };

  private handleRetry = () => {
    const { maxRetries = 3 } = this.props;
    const { retryCount } = this.state;

    if (retryCount < maxRetries) {
      this.setState(prevState => ({
        ...prevState,
        retryCount: prevState.retryCount + 1,
      }));

      // Reset after a short delay to allow cleanup
      this.resetTimeoutId = window.setTimeout(() => {
        this.resetError();
      }, 100);
    }
  };

  private toggleDetails = () => {
    this.setState(prevState => ({
      showDetails: !prevState.showDetails,
    }));
  };

  private copyErrorDetails = async () => {
    const { error, errorInfo, errorId } = this.state;
    
    const errorText = `
Error ID: ${errorId}
Error: ${error?.name}: ${error?.message}
Stack: ${error?.stack}
Component Stack: ${errorInfo?.componentStack}
URL: ${window.location.href}
Timestamp: ${new Date().toISOString()}
    `.trim();

    try {
      await navigator.clipboard.writeText(errorText);
      // Show success feedback (you might want to use a toast here)
      console.log('Error details copied to clipboard');
    } catch (err) {
      console.error('Failed to copy error details:', err);
    }
  };

  render() {
    const { 
      children, 
      fallback: CustomFallback, 
      level = 'component',
      className,
      maxRetries = 3 
    } = this.props;
    
    const { 
      hasError, 
      error, 
      errorInfo, 
      errorId, 
      retryCount, 
      showDetails, 
      reportSent 
    } = this.state;

    if (hasError && error) {
      if (CustomFallback) {
        return (
          <CustomFallback
            error={error}
            errorInfo={errorInfo}
            resetError={this.resetError}
            retryCount={retryCount}
            maxRetries={maxRetries}
            errorId={errorId}
            onReport={() => errorInfo && this.sendErrorReport(error, errorInfo, errorId)}
            level={level}
          />
        );
      }

      return (
        <div className={cn('error-boundary', className)}>
          <DefaultErrorFallback
            error={error}
            errorInfo={errorInfo}
            resetError={this.resetError}
            onRetry={this.handleRetry}
            retryCount={retryCount}
            maxRetries={maxRetries}
            errorId={errorId}
            level={level}
            showDetails={showDetails}
            onToggleDetails={this.toggleDetails}
            onCopyDetails={this.copyErrorDetails}
            reportSent={reportSent}
          />
        </div>
      );
    }

    return children;
  }
}

// Default Error Fallback Component
interface DefaultErrorFallbackProps {
  error: Error;
  errorInfo: ErrorInfo | null;
  resetError: () => void;
  onRetry: () => void;
  retryCount: number;
  maxRetries: number;
  errorId: string;
  level: 'page' | 'section' | 'component';
  showDetails: boolean;
  onToggleDetails: () => void;
  onCopyDetails: () => void;
  reportSent: boolean;
}

function DefaultErrorFallback({
  error,
  errorInfo,
  resetError,
  onRetry,
  retryCount,
  maxRetries,
  errorId,
  level,
  showDetails,
  onToggleDetails,
  onCopyDetails,
  reportSent,
}: DefaultErrorFallbackProps) {
  const getLevelConfig = () => {
    switch (level) {
      case 'page':
        return {
          title: 'Page Error',
          description: 'This page encountered an unexpected error.',
          containerClass: 'min-h-screen flex items-center justify-center p-4',
          cardClass: 'w-full max-w-2xl',
          showFullDetails: true,
        };
      case 'section':
        return {
          title: 'Section Error',
          description: 'This section encountered an error.',
          containerClass: 'p-4',
          cardClass: 'w-full',
          showFullDetails: true,
        };
      case 'component':
        return {
          title: 'Component Error',
          description: 'A component failed to render.',
          containerClass: 'p-2',
          cardClass: 'w-full',
          showFullDetails: false,
        };
      default:
        return {
          title: 'Error',
          description: 'Something went wrong.',
          containerClass: 'p-2',
          cardClass: 'w-full',
          showFullDetails: false,
        };
    }
  };

  const config = getLevelConfig();
  const canRetry = retryCount < maxRetries;

  return (
    <div className={config.containerClass}>
      <Card className={config.cardClass}>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <CardTitle className="text-destructive">{config.title}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Bug className="h-4 w-4" />
            <AlertTitle>Error Details</AlertTitle>
            <AlertDescription>
              <div className="space-y-2">
                <p>{config.description}</p>
                <p className="text-sm text-muted-foreground">
                  Error ID: <code className="bg-muted px-1 rounded">{errorId}</code>
                </p>
                {reportSent && (
                  <div className="flex items-center space-x-1 text-sm text-green-600">
                    <CheckCircle className="h-3 w-3" />
                    <span>Error report sent to support team</span>
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>

          <div className="flex flex-wrap gap-2">
            {canRetry && (
              <Button onClick={onRetry} variant="default" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry ({retryCount}/{maxRetries})
              </Button>
            )}
            
            <Button onClick={resetError} variant="outline" size="sm">
              Reset Component
            </Button>

            {config.showFullDetails && (
              <Button 
                onClick={onToggleDetails} 
                variant="outline" 
                size="sm"
              >
                {showDetails ? (
                  <>
                    <ChevronUp className="h-4 w-4 mr-2" />
                    Hide Details
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4 mr-2" />
                    Show Details
                  </>
                )}
              </Button>
            )}

            <Button onClick={onCopyDetails} variant="outline" size="sm">
              <Copy className="h-4 w-4 mr-2" />
              Copy Details
            </Button>

            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.open('/support', '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Get Help
            </Button>
          </div>

          {showDetails && config.showFullDetails && (
            <div className="space-y-3">
              <div>
                <h4 className="font-semibold text-sm mb-2">Error Message:</h4>
                <pre className="bg-muted p-3 rounded text-xs overflow-auto">
                  {error.name}: {error.message}
                </pre>
              </div>

              {error.stack && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Stack Trace:</h4>
                  <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-40">
                    {error.stack}
                  </pre>
                </div>
              )}

              {errorInfo?.componentStack && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Component Stack:</h4>
                  <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-40">
                    {errorInfo.componentStack}
                  </pre>
                </div>
              )}
            </div>
          )}

          {!canRetry && retryCount >= maxRetries && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Maximum retry attempts reached. Please refresh the page or contact support if the problem persists.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Utility Components for Suspense Boundaries

interface AsyncErrorBoundaryProps extends Omit<EnhancedErrorBoundaryProps, 'children' | 'fallback'> {
  children: ReactNode;
  fallback?: ReactNode;
  suspenseFallback?: ReactNode;
}

export function AsyncErrorBoundary({ 
  children, 
  fallback,
  suspenseFallback = <div>Loading...</div>,
  ...errorBoundaryProps 
}: AsyncErrorBoundaryProps) {
  return (
    <EnhancedErrorBoundary {...errorBoundaryProps}>
      <Suspense fallback={suspenseFallback}>
        {children}
      </Suspense>
    </EnhancedErrorBoundary>
  );
}

// Hook for manual error reporting
export function useErrorHandler() {
  const reportError = (error: Error, context?: Record<string, unknown>) => {
    const errorId = `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const logData = {
      errorId,
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: localStorage.getItem('userId'),
      type: 'manual',
    };

    // Log error
    console.error('Manual error report:', logData);

    // Send to logging service
    fetch('/api/v1/errors/log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
      },
      body: JSON.stringify(logData),
    }).catch(err => {
      console.error('Failed to send manual error report:', err);
    });

    return errorId;
  };

  return { reportError };
}

export default EnhancedErrorBoundary;