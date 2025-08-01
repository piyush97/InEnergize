// Critical Resource Loader - Optimize loading of critical resources
'use client';

import React, { useEffect, useCallback } from 'react';
import Head from 'next/head';

interface CriticalResourceLoaderProps {
  fonts?: string[];
  criticalImages?: string[];
  prefetchRoutes?: string[];
  preconnectDomains?: string[];
  criticalCSS?: string;
}

export const CriticalResourceLoader: React.FC<CriticalResourceLoaderProps> = ({
  fonts = ['/fonts/inter-var.woff2'],
  criticalImages = [],
  prefetchRoutes = ['/dashboard', '/automation', '/content'],
  preconnectDomains = ['https://media.licdn.com', 'https://cdn.openai.com'],
  criticalCSS
}) => {
  // Preload critical resources
  const preloadCriticalResources = useCallback(() => {
    // Preload fonts
    fonts.forEach((fontUrl) => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = fontUrl;
      link.as = 'font';
      link.type = 'font/woff2';
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    });

    // Preload critical images
    criticalImages.forEach((imageUrl) => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = imageUrl;
      link.as = 'image';
      document.head.appendChild(link);
    });

    // Prefetch routes on idle
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => {
        prefetchRoutes.forEach((route) => {
          const link = document.createElement('link');
          link.rel = 'prefetch';
          link.href = route;
          document.head.appendChild(link);
        });
      });
    } else {
      // Fallback for browsers without requestIdleCallback
      setTimeout(() => {
        prefetchRoutes.forEach((route) => {
          const link = document.createElement('link');
          link.rel = 'prefetch';
          link.href = route;
          document.head.appendChild(link);
        });
      }, 2000);
    }
  }, [fonts, criticalImages, prefetchRoutes]);

  useEffect(() => {
    preloadCriticalResources();
  }, [preloadCriticalResources]);

  return (
    <Head>
      {/* DNS prefetch for external domains */}
      {preconnectDomains.map((domain) => (
        <React.Fragment key={domain}>
          <link rel="dns-prefetch" href={domain} />
          <link rel="preconnect" href={domain} crossOrigin="anonymous" />
        </React.Fragment>
      ))}

      {/* Critical CSS */}
      {criticalCSS && (
        <style
          dangerouslySetInnerHTML={{ __html: criticalCSS }}
          data-critical="true"
        />
      )}

      {/* Resource hints */}
      <link rel="preload" href="/api/auth/session" as="fetch" crossOrigin="anonymous" />
      
      {/* Optimize loading */}
      <meta httpEquiv="x-dns-prefetch-control" content="on" />
      
      {/* Performance hints */}
      <meta name="format-detection" content="telephone=no" />
      <meta name="format-detection" content="date=no" />
      <meta name="format-detection" content="address=no" />
      <meta name="format-detection" content="email=no" />
    </Head>
  );
};

// Service Worker registration
export const registerServiceWorker = () => {
  if (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    process.env.NODE_ENV === 'production'
  ) {
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        
        console.log('SW registered: ', registration);

        // Handle updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New content is available
                if (confirm('New version available! Reload to update?')) {
                  window.location.reload();
                }
              }
            });
          }
        });
      } catch (error) {
        console.log('SW registration failed: ', error);
      }
    });
  }
};

// Critical CSS extraction (used at build time)
export const criticalCSS = `
  /* Critical above-the-fold styles */
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    margin: 0;
    padding: 0;
    background-color: #f9fafb;
    color: #111827;
    line-height: 1.5;
  }
  
  .header {
    background-color: #ffffff;
    border-bottom: 1px solid #e5e7eb;
    height: 64px;
    display: flex;
    align-items: center;
    padding: 0 1rem;
  }
  
  .main-content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 1rem;
  }
  
  .card {
    background-color: #ffffff;
    border-radius: 0.5rem;
    box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
    padding: 1.5rem;
    margin-bottom: 1rem;
  }
  
  .skeleton {
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: loading 1.5s infinite;
  }
  
  @keyframes loading {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  
  .btn-primary {
    background-color: #2563eb;
    color: #ffffff;
    border: none;
    border-radius: 0.375rem;
    padding: 0.5rem 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  
  .btn-primary:hover {
    background-color: #1d4ed8;
  }
  
  /* Mobile optimizations */
  @media (max-width: 768px) {
    .main-content {
      padding: 0.5rem;
    }
    
    .card {
      padding: 1rem;
    }
    
    .header {
      padding: 0 0.5rem;
    }
  }
`;

// Performance observer for First Input Delay
export const observeFirstInputDelay = () => {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return;

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.entryType === 'first-input') {
        const fid = entry.processingStart - entry.startTime;
        console.log('First Input Delay:', fid);
        
        // Report to analytics
        if (fid > 100) {
          console.warn('High First Input Delay detected:', fid);
        }
      }
    }
  });

  try {
    observer.observe({ entryTypes: ['first-input'] });
  } catch (e) {
    // FID not supported
  }
};

// Intersection Observer for lazy loading
export const createIntersectionObserver = (
  callback: IntersectionObserverCallback,
  options: IntersectionObserverInit = { threshold: 0.1, rootMargin: '50px' }
) => {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
    return null;
  }

  return new IntersectionObserver(callback, options);
};

// Resource loading priority manager
export class ResourcePriorityManager {
  private static instance: ResourcePriorityManager;
  private loadQueue: Array<{ url: string; priority: 'high' | 'medium' | 'low'; type: string }> = [];
  private isProcessing = false;

  static getInstance(): ResourcePriorityManager {
    if (!ResourcePriorityManager.instance) {
      ResourcePriorityManager.instance = new ResourcePriorityManager();
    }
    return ResourcePriorityManager.instance;
  }

  addResource(url: string, priority: 'high' | 'medium' | 'low', type: string) {
    this.loadQueue.push({ url, priority, type });
    this.loadQueue.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  private async processQueue() {
    if (this.loadQueue.length === 0) return;

    this.isProcessing = true;

    while (this.loadQueue.length > 0) {
      const resource = this.loadQueue.shift();
      if (!resource) continue;

      try {
        await this.loadResource(resource);
      } catch (error) {
        console.warn(`Failed to load resource: ${resource.url}`, error);
      }

      // Add delay between loads to avoid overwhelming the browser
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    this.isProcessing = false;
  }

  private loadResource(resource: { url: string; type: string }): Promise<void> {
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = resource.url;
      link.as = resource.type;
      
      if (resource.type === 'font') {
        link.crossOrigin = 'anonymous';
      }

      link.onload = () => resolve();
      link.onerror = () => reject(new Error(`Failed to load ${resource.url}`));

      document.head.appendChild(link);
    });
  }
}