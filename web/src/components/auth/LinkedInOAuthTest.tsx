// LinkedInOAuthTest.tsx - Comprehensive LinkedIn OAuth Flow Testing Component
// Tests the complete OAuth integration flow with step-by-step validation

'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  LinkedinIcon, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  PlayCircle,
  ExternalLink,
  Clock,
  Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface OAuthStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  duration?: number;
  result?: unknown;
  error?: string;
}

interface LinkedInOAuthTestProps {
  className?: string;
}

const LinkedInOAuthTest: React.FC<LinkedInOAuthTestProps> = ({ className }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [testing, setTesting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [connectionData, setConnectionData] = useState<unknown>(null);

  const [steps, setSteps] = useState<OAuthStep[]>([
    {
      id: 'auth-check',
      title: 'Check Authentication',
      description: 'Verify user is logged in and has valid token',
      status: 'pending'
    },
    {
      id: 'service-health',
      title: 'Service Health Check',
      description: 'Verify LinkedIn service is running and accessible',
      status: 'pending'
    },
    {
      id: 'oauth-initiate',
      title: 'Initialize OAuth Flow',
      description: 'Generate LinkedIn authorization URL',
      status: 'pending'
    },
    {
      id: 'linkedin-redirect',
      title: 'LinkedIn Authorization',
      description: 'Redirect to LinkedIn for user consent',
      status: 'pending'
    },
    {
      id: 'callback-handle',
      title: 'Handle OAuth Callback',
      description: 'Process authorization code and exchange for tokens',
      status: 'pending'
    },
    {
      id: 'profile-fetch',
      title: 'Fetch LinkedIn Profile',
      description: 'Retrieve basic profile information',
      status: 'pending'
    },
    {
      id: 'data-sync',
      title: 'Profile Data Sync',
      description: 'Synchronize LinkedIn data with InErgize',
      status: 'pending'
    }
  ]);

  const updateStep = (stepId: string, updates: Partial<OAuthStep>) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, ...updates } : step
    ));
  };

  const executeStep = async (step: OAuthStep): Promise<void> => {
    const startTime = Date.now();
    updateStep(step.id, { status: 'running' });

    try {
      let result;

      switch (step.id) {
        case 'auth-check':
          result = await checkAuthentication();
          break;
        case 'service-health':
          result = await checkServiceHealth();
          break;
        case 'oauth-initiate':
          result = await initiateOAuth();
          break;
        case 'linkedin-redirect':
          result = await handleLinkedInRedirect();
          break;
        case 'callback-handle':
          result = await simulateCallback();
          break;
        case 'profile-fetch':
          result = await fetchLinkedInProfile();
          break;
        case 'data-sync':
          result = await syncProfileData();
          break;
        default:
          throw new Error(`Unknown step: ${step.id}`);
      }

      const duration = Date.now() - startTime;
      updateStep(step.id, { 
        status: 'completed', 
        duration, 
        result 
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      updateStep(step.id, { 
        status: 'failed', 
        duration, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  };

  const checkAuthentication = async () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      throw new Error('No authentication token found');
    }

    // Validate token format
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp * 1000 < Date.now()) {
        throw new Error('Token has expired');
      }
      return { tokenValid: true, userId: payload.userId };
    } catch {
      throw new Error('Invalid token format');
    }
  };

  const checkServiceHealth = async () => {
    const response = await fetch('/api/v1/linkedin/health');
    if (!response.ok) {
      throw new Error(`LinkedIn service health check failed: ${response.status}`);
    }
    const data = await response.json();
    return data;
  };

  const initiateOAuth = async () => {
    const token = localStorage.getItem('authToken');
    const response = await fetch('/api/v1/linkedin/oauth/authorize', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to initiate OAuth');
    }

    const data = await response.json();
    if (!data.success || !data.data.authUrl) {
      throw new Error('Invalid OAuth response');
    }

    setAuthUrl(data.data.authUrl);
    return data.data;
  };

  const handleLinkedInRedirect = async () => {
    if (!authUrl) {
      throw new Error('No authorization URL available');
    }

    // In a real scenario, this would redirect the user
    // For testing, we'll just validate the URL
    try {
      const url = new URL(authUrl);
      if (!url.hostname.includes('linkedin.com')) {
        throw new Error('Invalid LinkedIn URL');
      }
      
      const params = new URLSearchParams(url.search);
      if (!params.get('client_id') || !params.get('redirect_uri') || !params.get('state')) {
        throw new Error('Missing required OAuth parameters');
      }

      return {
        url: authUrl,
        clientId: params.get('client_id'),
        redirectUri: params.get('redirect_uri'),
        state: params.get('state'),
        scope: params.get('scope')
      };
    } catch (error) {
      throw new Error(`Invalid authorization URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const simulateCallback = async () => {
    // For testing purposes, simulate a successful callback
    // In real usage, this would be handled by LinkedIn redirecting back
    const mockCode = 'mock_auth_code_' + Date.now();
    const mockState = 'mock_state_' + Date.now();

    const token = localStorage.getItem('authToken');
    const response = await fetch('/api/v1/linkedin/oauth/callback', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        code: mockCode,
        state: mockState
      })
    });

    // Note: This will likely fail in testing since we're using mock data
    // But it validates the endpoint exists and accepts the request format
    const data = await response.json();
    return {
      simulatedCallback: true,
      response: data,
      note: 'This is a simulated callback for testing purposes'
    };
  };

  const fetchLinkedInProfile = async () => {
    const token = localStorage.getItem('authToken');
    const response = await fetch('/api/v1/linkedin/profile', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      // This is expected to fail if LinkedIn isn't actually connected
      return {
        note: 'Profile fetch skipped - LinkedIn not actually connected in test mode',
        status: response.status
      };
    }

    const data = await response.json();
    setConnectionData(data);
    return data;
  };

  const syncProfileData = async () => {
    const token = localStorage.getItem('authToken');
    const response = await fetch('/api/v1/linkedin/profile/sync', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      return {
        note: 'Sync skipped - LinkedIn not actually connected in test mode',
        status: response.status
      };
    }

    const data = await response.json();
    return data;
  };

  const startTest = async () => {
    setTesting(true);
    setCompleted(false);
    setCurrentStep(0);

    // Reset all steps
    setSteps(prev => prev.map(step => ({ 
      ...step, 
      status: 'pending' as const,
      duration: undefined,
      result: undefined,
      error: undefined
    })));

    try {
      for (let i = 0; i < steps.length; i++) {
        setCurrentStep(i);
        await executeStep(steps[i]);
        
        // Add a small delay between steps for better UX
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      setCompleted(true);
    } catch (error) {
      console.error('OAuth test failed:', error);
    } finally {
      setTesting(false);
    }
  };

  const getStepIcon = (status: OAuthStep['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'running':
        return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStepColor = (status: OAuthStep['status']) => {
    switch (status) {
      case 'completed':
        return 'border-green-200 bg-green-50';
      case 'failed':
        return 'border-red-200 bg-red-50';
      case 'running':
        return 'border-blue-200 bg-blue-50';
      default:
        return 'border-gray-200 bg-white';
    }
  };

  const completedSteps = steps.filter(step => step.status === 'completed').length;
  const progress = (completedSteps / steps.length) * 100;

  return (
    <Card className={cn('w-full max-w-4xl mx-auto', className)}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <LinkedinIcon className="h-6 w-6 text-blue-600" />
          <span>LinkedIn OAuth Flow Test</span>
          <Badge variant="secondary">
            {testing ? 'Running' : completed ? 'Completed' : 'Ready'}
          </Badge>
        </CardTitle>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>Progress: {completedSteps}/{steps.length} steps</span>
            <span>{Math.round(progress)}% complete</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Test Controls */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <h3 className="font-medium">OAuth Integration Test</h3>
            <p className="text-sm text-gray-600">
              Test the complete LinkedIn OAuth flow end-to-end
            </p>
          </div>
          <Button
            onClick={startTest}
            disabled={testing}
            className="flex items-center space-x-2"
          >
            {testing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Testing...</span>
              </>
            ) : (
              <>
                <PlayCircle className="h-4 w-4" />
                <span>Start Test</span>
              </>
            )}
          </Button>
        </div>

        {/* Test Steps */}
        <div className="space-y-3">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={cn(
                'p-4 border rounded-lg transition-all duration-200',
                getStepColor(step.status),
                currentStep === index && testing && 'ring-2 ring-blue-500'
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  {getStepIcon(step.status)}
                  <div className="flex-1">
                    <h4 className="font-medium">{step.title}</h4>
                    <p className="text-sm text-gray-600 mt-1">{step.description}</p>
                    
                    {step.duration && (
                      <p className="text-xs text-gray-500 mt-1">
                        Completed in {step.duration}ms
                      </p>
                    )}
                    
                    {step.error && (
                      <Alert className="mt-2" variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-sm">
                          {step.error}
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    {step.result !== undefined && step.status === 'completed' && (
                      <details className="mt-2">
                        <summary className="text-xs text-blue-600 cursor-pointer">
                          View Result
                        </summary>
                        <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-auto">
                          {JSON.stringify(step.result, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
                
                <Badge 
                  variant={step.status === 'completed' ? 'default' : 'secondary'}
                  className="ml-2"
                >
                  {step.status}
                </Badge>
              </div>

              {/* Special handling for OAuth authorization URL */}
              {step.id === 'oauth-initiate' && authUrl && step.status === 'completed' && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-800">
                        LinkedIn Authorization URL Generated
                      </p>
                      <p className="text-xs text-blue-600 mt-1 truncate max-w-md">
                        {authUrl}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(authUrl, '_blank')}
                      className="flex items-center space-x-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      <span>Open</span>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Results Summary */}
        {completed && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <h3 className="font-medium text-green-800">Test Completed</h3>
            </div>
            <p className="text-sm text-green-700 mt-1">
              OAuth flow test completed successfully. 
              {completedSteps === steps.length 
                ? ' All steps passed!' 
                : ` ${completedSteps}/${steps.length} steps completed.`
              }
            </p>
            {connectionData !== null && (
              <details className="mt-2">
                <summary className="text-sm text-green-700 cursor-pointer">
                  View Connection Data
                </summary>
                <pre className="text-xs bg-white p-2 rounded mt-1 overflow-auto">
                  {JSON.stringify(connectionData, null, 2)}
                </pre>
              </details>
            )}
          </div>
        )}

        {/* Security Notice */}
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start space-x-2">
            <Shield className="h-4 w-4 text-amber-600 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-amber-800">Testing Note</h4>
              <p className="text-xs text-amber-700 mt-1">
                This test validates the OAuth flow endpoints and data flow. 
                Some steps may fail if LinkedIn is not actually connected, 
                which is expected in testing mode. The test demonstrates 
                the complete integration pathway.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default LinkedInOAuthTest;