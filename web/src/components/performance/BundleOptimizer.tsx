// Bundle Optimization Component - Dynamic imports and code splitting
'use client';

import React, { 
  lazy, 
  Suspense, 
  ComponentType, 
  LazyExoticComponent,
  memo,
  useEffect,
  useState
} from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { bundleAnalyzer } from '@/lib/performance';

// Dynamic import factory with error boundary
interface DynamicImportOptions {
  loading?: React.ComponentType;
  error?: React.ComponentType<{ error: Error; retry: () => void }>;
  timeout?: number;
  retries?: number;
}

export function createDynamicImport<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options: DynamicImportOptions = {}
): LazyExoticComponent<T> {
  const {
    loading: LoadingComponent = () => <Skeleton className="w-full h-32" />,
    error: ErrorComponent = DefaultErrorBoundary,
    timeout = 10000,
    retries = 3
  } = options;

  let retryCount = 0;
  
  const retryableImport = async (): Promise<{ default: T }> => {
    const startTime = performance.now();
    
    try {
      const result = await Promise.race([
        importFn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Import timeout')), timeout)
        ),
      ]);
      
      bundleAnalyzer.trackChunkLoad('dynamic-component', startTime);
      return result;
    } catch (error) {
      console.error(`Dynamic import failed (attempt ${retryCount + 1}):`, error);
      
      if (retryCount < retries) {
        retryCount++;
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
        return retryableImport();
      }
      
      throw error;
    }
  };

  const LazyComponent = lazy(retryableImport);

  return memo((props: React.ComponentProps<T>) => (
    <ErrorBoundary ErrorComponent={ErrorComponent}>
      <Suspense fallback={<LoadingComponent />}>
        <LazyComponent {...props} />
      </Suspense>
    </ErrorBoundary>
  )) as LazyExoticComponent<T>;
}

// Error boundary component
interface ErrorBoundaryProps {
  children: React.ReactNode;
  ErrorComponent: React.ComponentType<{ error: Error; retry: () => void }>;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Dynamic import error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      const retry = () => {
        this.setState({ hasError: false, error: null });
      };
      
      return <this.props.ErrorComponent error={this.state.error} retry={retry} />;
    }

    return this.props.children;
  }
}

// Default error component
const DefaultErrorBoundary: React.FC<{ error: Error; retry: () => void }> = ({ 
  error, 
  retry 
}) => (
  <div className="flex flex-col items-center justify-center p-6 bg-red-50 border border-red-200 rounded-lg">
    <div className="text-red-600 mb-2">Failed to load component</div>
    <div className="text-sm text-red-500 mb-4">{error.message}</div>
    <button
      onClick={retry}
      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
    >
      Retry
    </button>
  </div>
);

// Pre-built lazy components for common patterns
export const LazyComponents = {
  // Charts
  Chart: createDynamicImport(
    () => import('recharts').then(module => ({ default: module.ResponsiveContainer })),
    { loading: () => <Skeleton className="w-full h-64" /> }
  ),
  
  // 3D Visualization
  ThreeCanvas: createDynamicImport(
    () => import('@react-three/fiber').then(module => ({ default: module.Canvas })),
    { loading: () => <Skeleton className="w-full h-96" /> }
  ),
  
  // Automation Dashboard
  AutomationDashboard: createDynamicImport(
    () => import('@/components/automation/AutomationDashboardV3'),
    { loading: () => <Skeleton className="w-full h-[600px]" /> }
  ),
  
  // Profile Visualization
  ProfileVisualization3D: createDynamicImport(
    () => import('@/components/dashboard/ProfileVisualization3D'),
    { loading: () => <Skeleton className="w-full h-96" /> }
  ),
  
  // Content Generation Studio
  ContentGenerationStudio: createDynamicImport(
    () => import('@/components/ai/ContentGenerationStudio'),
    { loading: () => <Skeleton className="w-full h-[500px]" /> }
  ),
  
  // Banner Generator
  BannerGenerator: createDynamicImport(
    () => import('@/components/ai/BannerGenerator'),
    { loading: () => <Skeleton className="w-full h-[400px]" /> }
  ),
};

// Bundle preloader for critical routes
export const BundlePreloader: React.FC<{ routes: string[] }> = memo(({ routes }) => {
  const [preloadedRoutes, setPreloadedRoutes] = useState<Set<string>>(new Set());

  useEffect(() => {
    const preloadRoute = async (route: string) => {
      if (preloadedRoutes.has(route)) return;
      
      try {
        // Preload route chunk
        await import(`@/pages${route}`);
        setPreloadedRoutes(prev => new Set([...prev, route]));
        console.log(`[Preload] Route preloaded: ${route}`);
      } catch (error) {
        console.warn(`[Preload] Failed to preload route: ${route}`, error);
      }
    };

    // Preload routes with staggered timing
    routes.forEach((route, index) => {
      setTimeout(() => preloadRoute(route), index * 100);
    });
  }, [routes, preloadedRoutes]);

  return null;
});

BundlePreloader.displayName = 'BundlePreloader';

// Component for monitoring bundle performance
export const BundlePerformanceMonitor: React.FC = memo(() => {
  const [bundleStats, setBundleStats] = useState<{
    loadedChunks: number;
    totalSize: number;
    loadTime: number;
  }>({ loadedChunks: 0, totalSize: 0, loadTime: 0 });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const observer = new PerformanceObserver((list) => {
      let chunksLoaded = 0;
      let totalBytes = 0;
      let maxLoadTime = 0;

      for (const entry of list.getEntries()) {
        if (entry.entryType === 'resource') {
          const resource = entry as PerformanceResourceTiming;
          
          // Track JavaScript chunks
          if (resource.name.includes('_next/static/chunks/')) {
            chunksLoaded++;
            totalBytes += resource.transferSize || 0;
            maxLoadTime = Math.max(maxLoadTime, resource.duration);
          }
        }
      }

      if (chunksLoaded > 0) {
        setBundleStats(prev => ({
          loadedChunks: prev.loadedChunks + chunksLoaded,
          totalSize: prev.totalSize + totalBytes,
          loadTime: Math.max(prev.loadTime, maxLoadTime),
        }));
      }
    });

    observer.observe({ entryTypes: ['resource'] });
    
    return () => observer.disconnect();
  }, []);

  if (process.env.NODE_ENV !== 'development') return null;

  return (
    <div className="fixed bottom-4 left-4 bg-black bg-opacity-75 text-white p-3 rounded-lg text-xs font-mono z-50">
      <div>Chunks: {bundleStats.loadedChunks}</div>
      <div>Size: {(bundleStats.totalSize / 1024).toFixed(1)}KB</div>
      <div>Load: {bundleStats.loadTime.toFixed(0)}ms</div>
    </div>
  );
});

BundlePerformanceMonitor.displayName = 'BundlePerformanceMonitor';

// Hook for measuring component render performance
export const useRenderPerformance = (componentName: string) => {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const startTime = performance.now();
      
      return () => {
        const renderTime = performance.now() - startTime;
        bundleAnalyzer.measureComponentRender(componentName, () => {});
        
        if (renderTime > 50) {
          console.warn(`[Render] Component "${componentName}" took ${renderTime.toFixed(2)}ms to mount`);
        }
      };
    }
  }, [componentName]);
};

// Image optimization component with lazy loading
interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  priority?: boolean;
  sizes?: string;
  quality?: number;
}

export const OptimizedImage: React.FC<OptimizedImageProps> = memo(({
  src,
  alt,
  width,
  height,
  priority = false,
  sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
  quality = 75,
  className,
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentSrc, setCurrentSrc] = useState<string>('');
  const imgRef = React.useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (priority) {
      setCurrentSrc(src);
      return;
    }

    if (!imgRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setCurrentSrc(src);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, [src, priority]);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  return (
    <div className="relative overflow-hidden">
      {!isLoaded && (
        <Skeleton 
          className="absolute inset-0" 
          style={{ width, height }} 
        />
      )}
      <img
        ref={imgRef}
        src={currentSrc}
        alt={alt}
        width={width}
        height={height}
        onLoad={handleLoad}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        className={`transition-opacity duration-300 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        } ${className}`}
        {...props}
      />
    </div>
  );
});

OptimizedImage.displayName = 'OptimizedImage';