// Banner Generator Page - AI-powered LinkedIn banner creation
import { NextPage } from 'next';
import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
import AppLayout from '@/components/Layout/AppLayout';

// Dynamic import to avoid SSR issues
const BannerGenerator = dynamic(
  () => import('@/components/ai/BannerGenerator'),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    )
  }
);

const BannerGeneratorPage: NextPage = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status === 'loading') return;
    
    if (status === 'unauthenticated') {
      router.push('/auth/signin?callbackUrl=/tools/banner-generator');
      return;
    }

    setIsLoading(false);
  }, [status, router]);

  if (isLoading || status === 'loading') {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <>
      <Head>
        <title>AI Banner Generator - InErgize</title>
        <meta 
          name="description" 
          content="Create professional LinkedIn banners with AI-powered design. Industry-specific templates, DALL-E 3 generation, and LinkedIn compliance guaranteed." 
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <AppLayout className="bg-gray-50">
        <main className="min-h-screen">
          <BannerGenerator />
        </main>
      </AppLayout>
    </>
  );
};

export default BannerGeneratorPage;