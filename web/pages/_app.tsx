import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { AuthProvider } from '@/contexts/AuthContext'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { useState, useEffect } from 'react'
import Head from 'next/head'
import { initializePerformanceMonitoring } from '@/lib/performance'
import PerformanceMonitor from '@/components/ui/performance-monitor'
import { BundlePerformanceMonitor } from '@/components/performance/BundleOptimizer'

export default function App({
  Component,
  pageProps,
}: AppProps) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
        retry: (failureCount, error: any) => {
          // Don't retry on 4xx errors
          if (error?.response?.status < 500) return false;
          return failureCount < 2;
        },
        refetchOnWindowFocus: false,
        refetchOnReconnect: 'always',
      },
      mutations: {
        retry: 1,
      },
    },
  }))
  
  // Initialize performance monitoring
  useEffect(() => {
    const performanceMonitor = initializePerformanceMonitoring(
      process.env.NODE_ENV === 'production' ? '/api/v1/metrics/web-vitals' : undefined
    );
    
    return () => {
      performanceMonitor?.cleanup();
    };
  }, []);

  return (
    <>
      <Head>
        <title>InErgize - LinkedIn Profile Optimization</title>
        <meta name="description" content="AI-powered LinkedIn optimization platform for job seekers" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="theme-color" content="#2563eb" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        
        {/* Preload critical resources */}
        <link rel="preload" href="/fonts/inter-var.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        
        {/* DNS prefetch for external domains */}
        <link rel="dns-prefetch" href="//media.licdn.com" />
        <link rel="dns-prefetch" href="//cdn.openai.com" />
        
        {/* Optimize Core Web Vitals */}
        <meta name="format-detection" content="telephone=no" />
        <meta httpEquiv="x-ua-compatible" content="ie=edge" />
      </Head>
      
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Component {...pageProps} />
          <Toaster 
            position="top-right"
            containerClassName="toast-container"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
                fontSize: '14px',
                fontWeight: '500',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              },
              success: {
                duration: 3000,
                iconTheme: {
                  primary: '#22c55e',
                  secondary: '#fff',
                },
              },
              error: {
                duration: 5000,
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#fff',
                },
              },
              loading: {
                duration: Infinity,
              },
            }}
          />
          
          {/* Performance Monitors - only in development */}
          {process.env.NODE_ENV === 'development' && (
            <>
              <div className="fixed bottom-4 right-4 z-50 w-80">
                <PerformanceMonitor enabled={true} showDetails={true} />
              </div>
              <BundlePerformanceMonitor />
            </>
          )}
        </AuthProvider>
      </QueryClientProvider>
    </>
  )
}