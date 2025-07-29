// Schedule Page - Main entry point for the post scheduling system
// Integrates all scheduling components with authentication and error handling

import { NextPage } from 'next';
import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
import AppLayout from '@/components/Layout/AppLayout';

// Dynamic import to avoid SSR issues with complex scheduling components
const SchedulingDashboard = dynamic(
  () => import('@/components/scheduling/SchedulingDashboard'),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading scheduling dashboard...</p>
        </div>
      </div>
    )
  }
);

const SchedulePage: NextPage = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [linkedinProfileId, setLinkedinProfileId] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    
    if (status === 'unauthenticated') {
      router.push('/auth/signin?callbackUrl=/schedule');
      return;
    }

    // Check if user has LinkedIn connected
    if (session?.user) {
      loadLinkedInProfile();
    }
    
    setIsLoading(false);
  }, [status, router, session]);

  const loadLinkedInProfile = async () => {
    try {
      const response = await fetch('/api/v1/linkedin/profile', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setLinkedinProfileId(data.profile?.id || null);
      }
    } catch (err) {
      console.warn('Failed to load LinkedIn profile:', err);
    }
  };

  const handleContentScheduled = (eventId: string) => {
    // Optional: Show success notification or update analytics
    console.log('Content scheduled:', eventId);
  };

  const handleBulkSchedule = (events: unknown[]) => {
    // Optional: Show bulk scheduling success notification
    console.log('Bulk scheduled:', events.length, 'items');
  };

  if (isLoading || status === 'loading') {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading your scheduling dashboard...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <>
      <Head>
        <title>Content Scheduler - InErgize</title>
        <meta 
          name="description" 
          content="Schedule your LinkedIn content with AI-powered timing optimization. Maximize engagement with intelligent posting schedules and LinkedIn compliance monitoring." 
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <AppLayout className="bg-gray-50">
        <main className="min-h-screen">
          <SchedulingDashboard
            userId={session?.user?.id || ''}
            linkedinProfileId={linkedinProfileId || undefined}
            onContentScheduled={handleContentScheduled}
            onBulkSchedule={handleBulkSchedule}
          />
        </main>
      </AppLayout>
    </>
  );
};

export default SchedulePage;