import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/router';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  requireSubscription?: 'basic' | 'premium' | 'enterprise';
  redirectTo?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAuth = true,
  requireSubscription,
  redirectTo = '/auth/login'
}) => {
  const { user, loading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      // Check authentication requirement
      if (requireAuth && !isAuthenticated) {
        router.push(redirectTo);
        return;
      }

      // Check subscription requirement
      if (requireSubscription && user) {
        const subscriptionLevels = {
          free: 0,
          basic: 1,
          premium: 2,
          enterprise: 3
        };

        const userLevel = subscriptionLevels[user.subscriptionLevel];
        const requiredLevel = subscriptionLevels[requireSubscription];

        if (userLevel < requiredLevel) {
          router.push('/subscription/upgrade');
          return;
        }
      }
    }
  }, [loading, isAuthenticated, user, requireAuth, requireSubscription, router, redirectTo]);

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show nothing while redirecting
  if (requireAuth && !isAuthenticated) {
    return null;
  }

  // Check subscription level if required
  if (requireSubscription && user) {
    const subscriptionLevels = {
      free: 0,
      basic: 1,
      premium: 2,
      enterprise: 3
    };

    const userLevel = subscriptionLevels[user.subscriptionLevel];
    const requiredLevel = subscriptionLevels[requireSubscription];

    if (userLevel < requiredLevel) {
      return null; // Will redirect via useEffect
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;