"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Square,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Shield,
  Activity,
  Loader2,
  Play,
  RefreshCw,
  AlertOctagon,
  Info,
  Zap,
  Timer
} from "lucide-react";

import { useAutomation } from "@/contexts/AutomationContext";
import { useWebSocketEvent } from "@/contexts/WebSocketProvider";

interface EmergencyStopComponentProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  currentStatus: 'active' | 'paused' | 'suspended';
  className?: string;
}

interface StopProgress {
  stage: 'preparing' | 'stopping_connections' | 'stopping_engagement' | 'clearing_queue' | 'completed' | 'error';
  progress: number;
  message: string;
  details?: string;
}

export default function EmergencyStopComponent({
  isOpen,
  onClose,
  onConfirm,
  currentStatus,
  className
}: EmergencyStopComponentProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [stopProgress, setStopProgress] = useState<StopProgress>({
    stage: 'preparing',
    progress: 0,
    message: 'Preparing to stop automation...',
  });
  const [confirmationText, setConfirmationText] = useState('');
  const [secondsRemaining, setSecondsRemaining] = useState(10);
  const [canConfirm, setCanConfirm] = useState(false);
  
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  
  // Automation context for additional data
  const { queueItems, overview } = useAutomation();
  
  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setIsConfirming(false);
      setIsStopping(false);
      setConfirmationText('');
      setSecondsRemaining(10);
      setCanConfirm(false);
      setStopProgress({
        stage: 'preparing',
        progress: 0,
        message: 'Preparing to stop automation...',
      });
    }
  }, [isOpen]);
  
  // Countdown timer for confirmation
  useEffect(() => {
    if (!isOpen || isStopping || canConfirm) return;
    
    const timer = setInterval(() => {
      setSecondsRemaining(prev => {
        if (prev <= 1) {
          setCanConfirm(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [isOpen, isStopping, canConfirm]);

  // Focus management for accessibility
  useEffect(() => {
    if (isOpen && dialogRef.current) {
      const focusableElements = dialogRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      if (focusableElements.length > 0) {
        (focusableElements[0] as HTMLElement).focus();
      }
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;
      
      if (event.key === 'Escape' && !isStopping) {
        event.preventDefault();
        onClose();
      }
      
      if (event.key === 'Tab') {
        // Basic tab trapping within modal
        const focusableElements = dialogRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        if (focusableElements && focusableElements.length > 0) {
          const firstElement = focusableElements[0] as HTMLElement;
          const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
          
          if (event.shiftKey && document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
          } else if (!event.shiftKey && document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isStopping, onClose]);

  // Listen for automation stop events
  useWebSocketEvent('automation_stopped', useCallback((data) => {
    setStopProgress({
      stage: 'completed',
      progress: 100,
      message: 'Automation successfully stopped',
      details: `Stopped ${data.itemsStopped || 0} pending actions`
    });
  }, []));

  // Simulate stop progress (in real implementation this would come from WebSocket events)
  const simulateStopProgress = useCallback(async () => {
    const stages: StopProgress[] = [
      {
        stage: 'preparing',
        progress: 10,
        message: 'Preparing emergency stop...',
        details: 'Validating current state'
      },
      {
        stage: 'stopping_connections',
        progress: 30,
        message: 'Stopping connection requests...',
        details: 'Cancelling pending connection requests'
      },
      {
        stage: 'stopping_engagement',
        progress: 60,
        message: 'Stopping engagement automation...',
        details: 'Cancelling likes and comments'
      },
      {
        stage: 'clearing_queue',
        progress: 85,
        message: 'Clearing automation queue...',
        details: `Clearing ${queueItems?.length || 0} queued items`
      },
      {
        stage: 'completed',
        progress: 100,
        message: 'Emergency stop completed',
        details: 'All automation activities have been stopped'
      }
    ];

    for (const stage of stages) {
      setStopProgress(stage);
      await new Promise(resolve => setTimeout(resolve, 800));
    }
  }, [queueItems?.length]);

  // Handle confirmation
  const handleConfirm = useCallback(async () => {
    if (!canConfirm || confirmationText !== 'STOP') return;
    
    setIsStopping(true);
    
    try {
      // Start the stop process
      simulateStopProgress();
      
      // Call the actual stop function
      await onConfirm();
      
      // Auto-close after success
      setTimeout(() => {
        onClose();
      }, 2000);
      
    } catch (error) {
      console.error('Emergency stop failed:', error);
      setStopProgress({
        stage: 'error',
        progress: 0,
        message: 'Emergency stop failed',
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  }, [canConfirm, confirmationText, onConfirm, onClose, simulateStopProgress]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    if (!isStopping) {
      onClose();
    }
  }, [isStopping, onClose]);

  // Don't render if not open
  if (!isOpen) return null;

  const getStageIcon = (stage: StopProgress['stage']) => {
    switch (stage) {
      case 'preparing':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-600" />;
      case 'stopping_connections':
      case 'stopping_engagement':
      case 'clearing_queue':
        return <Loader2 className="h-5 w-5 animate-spin text-orange-600" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-600" />;
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-50 transition-opacity"
        onClick={!isStopping ? handleCancel : undefined}
        aria-hidden="true"
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          ref={dialogRef}
          className={`bg-white rounded-lg shadow-xl max-w-md w-full max-h-screen overflow-auto ${className}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="emergency-stop-title"
          aria-describedby="emergency-stop-description"
        >
          <Card className="border-0 shadow-none">
            <CardHeader className="text-center border-b">
              <div className="flex items-center justify-center mb-4">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertOctagon className="h-8 w-8 text-red-600" />
                </div>
              </div>
              <CardTitle id="emergency-stop-title" className="text-xl text-red-600">
                Emergency Stop
              </CardTitle>
              <CardDescription id="emergency-stop-description">
                This will immediately stop all LinkedIn automation activities
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6">
              {!isStopping ? (
                <div className="space-y-6">
                  {/* Current Status */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Current Status</span>
                      <Badge variant={currentStatus === 'active' ? 'default' : 'secondary'}>
                        {currentStatus}
                      </Badge>
                    </div>
                    
                    {overview && (
                      <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                        <div>
                          <span className="block font-medium">Queue Items</span>
                          <span>{queueItems?.length || 0} pending</span>
                        </div>
                        <div>
                          <span className="block font-medium">Active Since</span>
                          <span>{overview.lastActivity ? new Date(overview.lastActivity).toLocaleTimeString() : 'N/A'}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Warning */}
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Warning:</strong> This action will immediately:
                      <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                        <li>Cancel all pending connection requests</li>
                        <li>Stop engagement automation (likes, comments)</li>
                        <li>Clear the automation queue</li>
                        <li>Pause all scheduled activities</li>
                      </ul>
                    </AlertDescription>
                  </Alert>

                  {/* Confirmation Input */}
                  <div className="space-y-3">
                    <label htmlFor="confirmation-input" className="block text-sm font-medium text-gray-700">
                      Type <strong>STOP</strong> to confirm:
                    </label>
                    <input
                      id="confirmation-input"
                      type="text"
                      value={confirmationText}
                      onChange={(e) => setConfirmationText(e.target.value.toUpperCase())}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      placeholder="Type STOP to confirm"
                      disabled={!canConfirm}
                      aria-describedby="confirmation-help"
                    />
                    <p id="confirmation-help" className="text-xs text-gray-500">
                      {!canConfirm ? (
                        <>Please wait {secondsRemaining} seconds before confirming</>
                      ) : (
                        <>Type "STOP" exactly as shown to enable the emergency stop button</>
                      )}
                    </p>
                  </div>

                  {/* Countdown */}
                  {!canConfirm && (
                    <div className="text-center">
                      <div className="inline-flex items-center space-x-2 text-sm text-gray-600">
                        <Timer className="h-4 w-4" />
                        <span>Safety delay: {secondsRemaining} seconds</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Stop Progress */}
                  <div className="text-center space-y-4">
                    <div className="flex items-center justify-center">
                      {getStageIcon(stopProgress.stage)}
                    </div>
                    
                    <div>
                      <h3 className="font-medium text-gray-900">{stopProgress.message}</h3>
                      {stopProgress.details && (
                        <p className="text-sm text-gray-600 mt-1">{stopProgress.details}</p>
                      )}
                    </div>
                    
                    <div className="w-full">
                      <Progress value={stopProgress.progress} className="h-2" />
                      <p className="text-xs text-gray-500 mt-1">
                        {stopProgress.progress}% complete
                      </p>
                    </div>
                  </div>

                  {/* Error state */}
                  {stopProgress.stage === 'error' && (
                    <Alert variant="destructive">
                      <XCircle className="h-4 w-4" />
                      <AlertDescription>
                        {stopProgress.details || 'Emergency stop failed. Please try again or contact support.'}
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Success state */}
                  {stopProgress.stage === 'completed' && (
                    <Alert className="border-green-200 bg-green-50">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-800">
                        All automation activities have been successfully stopped.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </CardContent>

            {/* Actions */}
            {!isStopping && (
              <div className="flex justify-between p-6 border-t bg-gray-50">
                <Button 
                  ref={cancelButtonRef}
                  variant="outline" 
                  onClick={handleCancel}
                  className="min-w-[100px]"
                >
                  Cancel
                </Button>
                
                <Button
                  ref={confirmButtonRef}
                  variant="destructive"
                  onClick={handleConfirm}
                  disabled={!canConfirm || confirmationText !== 'STOP'}
                  className="min-w-[100px] bg-red-600 hover:bg-red-700 focus:ring-2 focus:ring-red-500"
                  aria-describedby="stop-button-help"
                >
                  <Square className="h-4 w-4 mr-2" />
                  Stop Now
                </Button>
              </div>
            )}
            
            {isStopping && stopProgress.stage === 'completed' && (
              <div className="p-6 border-t bg-gray-50 text-center">
                <Button onClick={onClose} className="min-w-[100px]">
                  Close
                </Button>
              </div>
            )}
            
            {isStopping && stopProgress.stage === 'error' && (
              <div className="flex justify-between p-6 border-t bg-gray-50">
                <Button variant="outline" onClick={onClose}>
                  Close
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={() => {
                    setIsStopping(false);
                    setStopProgress({
                      stage: 'preparing',
                      progress: 0,
                      message: 'Preparing to stop automation...',
                    });
                  }}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}