// Content Generation Page - Showcase AI-powered content creation
import { NextPage } from 'next';
import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
import AppLayout from '@/components/Layout/AppLayout';

// Dynamic import to avoid SSR issues
const ContentGenerationStudio = dynamic(
  () => import('@/components/content/ContentGenerationStudio'),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }
);

const ContentPage: NextPage = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status === 'loading') return;
    
    if (status === 'unauthenticated') {
      router.push('/auth/signin?callbackUrl=/content');
      return;
    }

    setIsLoading(false);
  }, [status, router]);

  if (isLoading || status === 'loading') {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <>
      <Head>
        <title>AI Content Generation - InErgize</title>
        <meta 
          name="description" 
          content="Create engaging LinkedIn content with AI-powered assistance. Generate posts, articles, and carousels optimized for maximum engagement." 
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <AppLayout className="bg-gray-50">
        <main className="min-h-screen">
          <ContentGenerationStudio />
        </main>
      </AppLayout>
    </>
  );
};

export default ContentPage;