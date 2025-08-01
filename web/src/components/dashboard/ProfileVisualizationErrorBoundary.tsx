'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  RefreshCw,
  Bug,
  HelpCircle,
  ExternalLink,
  Download,
  Copy,
  CheckCircle
} from 'lucide-react';

// Types for error boundary
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  errorId: string;
  retryCount: number;
  dismissed: boolean;
}

interface ProfileVisualizationErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  enableReporting?: boolean;
  maxRetries?: number;
  className?: string;
}

interface ErrorReport {
  errorId: string;
  timestamp: Date;
  userAgent: string;
  url: string;
  stack?: string;
  componentStack?: string;
  userId?: string;
  additionalInfo?: Record<string, any>;
}

class ProfileVisualizationErrorBoundary extends Component<
  ProfileVisualizationErrorBoundaryProps,
  ErrorBoundaryState
> {
  private retryTimeout?: NodeJS.Timeout;

  constructor(props: ProfileVisualizationErrorBoundaryProps) {
    super(props);
    
    this.state = {
      hasError: false,
      errorId: '',
      retryCount: 0,
      dismissed: false
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    const errorId = `viz-error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      hasError: true,
      error,
      errorId,
      dismissed: false
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError, enableReporting = true } = this.props;
    
    this.setState({ errorInfo });
    
    // Call custom error handler
    onError?.(error, errorInfo);
    
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.group('🚨 Profile Visualization Error');
      console.error('Error:', error);
      console.error('Component Stack:', errorInfo.componentStack);
      console.error('Error Boundary State:', this.state);
      console.groupEnd();
    }
    
    // Report error to monitoring service
    if (enableReporting) {
      this.reportError(error, errorInfo);
    }
  }

  private reportError = async (error: Error, errorInfo: ErrorInfo) => {
    try {
      const errorReport: ErrorReport = {
        errorId: this.state.errorId,
        timestamp: new Date(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        userId: localStorage.getItem('userId') || undefined,
        additionalInfo: {
          retryCount: this.state.retryCount,
          visualizationMode: localStorage.getItem('profile-dashboard-preferences'),
          lastAction: localStorage.getItem('lastUserAction')
        }
      };

      // Send to error reporting service
      await fetch('/api/v1/errors/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify(errorReport)
      });

      console.log('Error reported successfully:', errorReport.errorId);
    } catch (reportingError) {
      console.error('Failed to report error:', reportingError);
    }
  };

  private handleRetry = () => {
    const { maxRetries = 3 } = this.props;
    
    if (this.state.retryCount < maxRetries) {
      this.setState(prevState => ({
        hasError: false,
        error: undefined,
        errorInfo: undefined,
        retryCount: prevState.retryCount + 1,
        dismissed: false
      }));
      
      // Add a small delay before retrying to prevent immediate re-error
      this.retryTimeout = setTimeout(() => {
        // Force re-render
        this.forceUpdate();
      }, 100);
    }
  };

  private handleDismiss = () => {
    this.setState({ dismissed: true });
  };

  private copyErrorToClipboard = async () => {
    const { error, errorInfo, errorId } = this.state;
    
    const errorText = `
Profile Visualization Error Report
=================================
Error ID: ${errorId}
Timestamp: ${new Date().toISOString()}
URL: ${window.location.href}

Error Message:
${error?.message || 'Unknown error'}

Stack Trace:
${error?.stack || 'No stack trace available'}

Component Stack:
${errorInfo?.componentStack || 'No component stack available'}

Browser Info:
${navigator.userAgent}
    `.trim();

    try {
      await navigator.clipboard.writeText(errorText);
      
      // Show success feedback (you might want to use a toast here)
      const button = document.querySelector('[data-copy-error]') as HTMLElement;
      if (button) {
        const originalText = button.textContent;
        button.textContent = 'Copied!';
        setTimeout(() => {
          button.textContent = originalText;
        }, 2000);
      }
    } catch (err) {
      console.error('Failed to copy error to clipboard:', err);
    }
  };

  private downloadErrorReport = () => {
    const { error, errorInfo, errorId } = this.state;
    
    const errorReport = {
      errorId,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      error: {
        message: error?.message,
        stack: error?.stack,
        name: error?.name
      },
      componentStack: errorInfo?.componentStack,
      retryCount: this.state.retryCount,
      additionalInfo: {
        visualizationMode: localStorage.getItem('profile-dashboard-preferences'),
        lastAction: localStorage.getItem('lastUserAction')
      }
    };

    const blob = new Blob([JSON.stringify(errorReport, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `profile-viz-error-${errorId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  componentWillUnmount() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
  }

  render() {
    const { children, fallback, maxRetries = 3, className } = this.props;
    const { hasError, error, errorId, retryCount, dismissed } = this.state;

    if (hasError && !dismissed) {
      if (fallback) {
        return fallback;
      }

      const canRetry = retryCount < maxRetries;
      const isRecoverable = error?.name !== 'ChunkLoadError' && 
                           error?.message?.includes('Network') === false;

      return (
        <div className={cn('min-h-[400px] flex items-center justify-center p-4', className)}>
          <Card className="max-w-2xl w-full border-red-200 bg-red-50">
            <CardHeader className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
              
              <CardTitle className="text-red-800 text-xl mb-2">
                Profile Visualization Error
              </CardTitle>
              
              <div className="flex items-center justify-center space-x-2 mb-4">
                <Badge variant="destructive" className="text-xs">
                  Error ID: {errorId}
                </Badge>
                
                {retryCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    Retry {retryCount}/{maxRetries}
                  </Badge>
                )}
              </div>
            </CardHeader>
            
            <CardContent>
              <div className="space-y-6">
                {/* Error Message */}
                <div className="bg-white rounded-lg p-4 border border-red-200">
                  <h4 className="font-medium text-gray-900 mb-2 flex items-center">
                    <Bug className="h-4 w-4 text-red-500 mr-2" />
                    Error Details
                  </h4>
                  <p className="text-sm text-gray-700 font-mono">
                    {error?.message || 'An unexpected error occurred in the profile visualization component.'}
                  </p>
                  
                  {process.env.NODE_ENV === 'development' && error?.stack && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
                        Show Stack Trace
                      </summary>
                      <pre className="mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded overflow-x-auto">
                        {error.stack}
                      </pre>
                    </details>
                  )}
                </div>

                {/* Suggested Actions */}
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <h4 className="font-medium text-blue-900 mb-3 flex items-center">
                    <HelpCircle className="h-4 w-4 text-blue-600 mr-2" />
                    What you can do:
                  </h4>
                  
                  <ul className="space-y-2 text-sm text-blue-800">
                    <li className="flex items-start">
                      <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
                      <span>Try refreshing the page or switching to a different visualization mode</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
                      <span>Check your internet connection and try again</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
                      <span>Disable browser extensions that might interfere with the visualization</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
                      <span>Contact support if the problem persists</span>
                    </li>
                  </ul>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3 justify-center">
                  {canRetry && isRecoverable && (
                    <Button onClick={this.handleRetry} className="flex items-center">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Try Again ({maxRetries - retryCount} attempts left)
                    </Button>
                  )}
                  
                  <Button
                    variant="outline"
                    onClick={() => window.location.reload()}
                    className="flex items-center"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh Page
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={this.handleDismiss}
                    className="flex items-center"
                  >
                    Continue Without Visualization
                  </Button>
                </div>

                {/* Developer Actions */}
                <div className="flex flex-wrap gap-2 justify-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={this.copyErrorToClipboard}
                    className="flex items-center text-xs"
                    data-copy-error
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy Error
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={this.downloadErrorReport}
                    className="flex items-center text-xs"
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Download Report
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open('https://github.com/inergize/support', '_blank')}
                    className="flex items-center text-xs"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Get Help
                  </Button>
                </div>

                {/* Footer */}
                <div className="text-center text-xs text-gray-500 pt-4 border-t border-red-200">
                  This error has been automatically reported to help improve the experience.
                  <br />
                  Error ID: <code className="bg-gray-100 px-1 rounded">{errorId}</code>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return children;
  }
}

// HOC for wrapping components with error boundary
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Partial<ProfileVisualizationErrorBoundaryProps>
) {
  const WrappedComponent = (props: P) => (
    <ProfileVisualizationErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ProfileVisualizationErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  return WrappedComponent;
}

// Hook for error reporting in functional components
export function useErrorReporting() {
  const reportError = React.useCallback(async (error: Error, additionalInfo?: Record<string, any>) => {
    const errorId = `viz-error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const errorReport: ErrorReport = {
        errorId,
        timestamp: new Date(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        stack: error.stack,
        userId: localStorage.getItem('userId') || undefined,
        additionalInfo
      };

      await fetch('/api/v1/errors/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify(errorReport)
      });

      return errorId;
    } catch (reportingError) {
      console.error('Failed to report error:', reportingError);
      return null;
    }
  }, []);

  return { reportError };
}

export default ProfileVisualizationErrorBoundary;