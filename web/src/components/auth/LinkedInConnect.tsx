import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  LinkedinIcon, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  Shield,
  TrendingUp,
  Users,
  BarChart3,
  Unlink
} from 'lucide-react';

interface LinkedInConnectProps {
  onConnectionChange?: (connected: boolean) => void;
}

const LinkedInConnect: React.FC<LinkedInConnectProps> = ({ onConnectionChange }) => {
  const { user, connectLinkedIn, disconnectLinkedIn, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleOAuthCallback = useCallback(async (code: string, state: string) => {
    try {
      setLoading(true);
      setError('');

      // Send authorization code to backend
      const response = await fetch('/api/v1/linkedin/oauth/callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ code, state })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to complete LinkedIn connection');
      }

      if (data.success) {
        updateUser({ linkedinConnected: true });
        setSuccess('LinkedIn account connected successfully!');
        onConnectionChange?.(true);
        
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
      } else {
        throw new Error(data.error || 'Failed to complete LinkedIn connection');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect LinkedIn account');
    } finally {
      setLoading(false);
    }
  }, [updateUser, onConnectionChange]);

  useEffect(() => {
    // Handle OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');

    if (error) {
      setError('LinkedIn connection was cancelled or failed');
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (code && state) {
      handleOAuthCallback(code, state);
    }
  }, [handleOAuthCallback]);

  const handleConnect = async () => {
    try {
      setLoading(true);
      setError('');
      await connectLinkedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect LinkedIn account');
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect your LinkedIn account? This will stop data synchronization and analytics.')) {
      return;
    }

    try {
      setLoading(true);
      setError('');
      await disconnectLinkedIn();
      setSuccess('LinkedIn account disconnected successfully');
      onConnectionChange?.(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect LinkedIn account');
    } finally {
      setLoading(false);
    }
  };

  const benefits = [
    {
      icon: TrendingUp,
      title: 'Profile Analytics',
      description: 'Real-time insights into profile views and engagement'
    },
    {
      icon: Users,
      title: 'Network Growth',
      description: 'Track connections and network expansion metrics'
    },
    {
      icon: BarChart3,
      title: 'Performance Metrics',
      description: 'Detailed analytics on post performance and reach'
    },
    {
      icon: Shield,
      title: 'Safe Automation',
      description: 'LinkedIn-compliant automation with built-in safety limits'
    }
  ];

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center">
          <LinkedinIcon className="h-6 w-6 mr-2 text-blue-600" />
          LinkedIn Integration
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              {success}
            </AlertDescription>
          </Alert>
        )}

        {user?.linkedinConnected ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center">
                <CheckCircle className="h-5 w-5 text-green-600 mr-3" />
                <div>
                  <p className="font-medium text-green-800">LinkedIn Connected</p>
                  <p className="text-sm text-green-600">
                    Your LinkedIn account is connected and syncing data
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                disabled={loading}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Unlink className="h-4 w-4 mr-2" />
                )}
                Disconnect
              </Button>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium text-blue-800 mb-2">What happens next?</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Profile data will sync automatically every 24 hours</li>
                <li>• Analytics will be available in your dashboard within minutes</li>
                <li>• You can schedule posts and manage content from InErgize</li>
                <li>• Safe automation features are now available</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="text-center py-6">
              <LinkedinIcon className="h-16 w-16 text-blue-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Connect Your LinkedIn Account</h3>
              <p className="text-gray-600 mb-6">
                Unlock powerful analytics and optimization tools by connecting your LinkedIn profile
              </p>
              
              <Button
                onClick={handleConnect}
                disabled={loading}
                size="lg"
                className="bg-blue-600 hover:bg-blue-700"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <LinkedinIcon className="h-5 w-5 mr-2" />
                    Connect LinkedIn Account
                  </>
                )}
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {benefits.map((benefit, index) => {
                const IconComponent = benefit.icon;
                return (
                  <div key={index} className="p-4 border rounded-lg">
                    <div className="flex items-start">
                      <IconComponent className="h-5 w-5 text-blue-600 mr-3 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-gray-900">{benefit.title}</h4>
                        <p className="text-sm text-gray-600 mt-1">{benefit.description}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-4 bg-gray-50 border rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2 flex items-center">
                <Shield className="h-4 w-4 mr-2" />
                Privacy & Security
              </h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• We only access data you explicitly allow through LinkedIn's official API</li>
                <li>• Your LinkedIn credentials are never stored on our servers</li>
                <li>• All data transfer is encrypted and secure</li>
                <li>• You can disconnect at any time and remove all permissions</li>
                <li>• We strictly follow LinkedIn's terms of service and rate limits</li>
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LinkedInConnect;