// Optimized Components Library - Production-ready performance components
'use client';

import React, { 
  memo, 
  forwardRef, 
  lazy, 
  Suspense, 
  useCallback, 
  useMemo, 
  useState,
  useEffect,
  useRef
} from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';

// Virtual scrolling hook for large lists
export const useVirtualScroll = (
  items: any[], 
  itemHeight: number, 
  containerHeight: number
) => {
  const [scrollTop, setScrollTop] = useState(0);
  
  const visibleRange = useMemo(() => {
    const start = Math.floor(scrollTop / itemHeight);
    const end = Math.min(
      start + Math.ceil(containerHeight / itemHeight) + 1,
      items.length
    );
    return { start, end };
  }, [scrollTop, itemHeight, containerHeight, items.length]);

  const visibleItems = useMemo(() => 
    items.slice(visibleRange.start, visibleRange.end).map((item, index) => ({
      ...item,
      index: visibleRange.start + index,
    }))
  , [items, visibleRange]);

  return {
    visibleItems,
    totalHeight: items.length * itemHeight,
    offsetY: visibleRange.start * itemHeight,
    onScroll: (e: React.UIEvent<HTMLDivElement>) => {
      setScrollTop(e.currentTarget.scrollTop);
    },
  };
};

// Optimized Virtual List Component
interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  height: number;
  renderItem: (item: T, index: number) -> React.ReactNode;
  className?: string;
  loadingCount?: number;
}

export const VirtualList = memo(<T,>({
  items,
  itemHeight,
  height,
  renderItem,
  className,
  loadingCount = 5
}: VirtualListProps<T>) => {
  const { visibleItems, totalHeight, offsetY, onScroll } = useVirtualScroll(
    items,
    itemHeight,
    height
  );

  if (items.length === 0) {
    return (
      <div className={cn("space-y-2", className)} style={{ height }}>
        {[...Array(loadingCount)].map((_, i) => (
          <Skeleton key={i} style={{ height: itemHeight }} />
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn("overflow-auto", className)}
      style={{ height }}
      onScroll={onScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item) => (
            <div key={item.index} style={{ height: itemHeight }}>
              {renderItem(item, item.index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}) as <T>(props: VirtualListProps<T>) -> JSX.Element;

VirtualList.displayName = 'VirtualList';

// Optimized Image Component with progressive loading
interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  priority?: boolean;
  placeholder?: 'blur' | 'empty';
  blurDataURL?: string;
  fallbackSrc?: string;
  onLoadComplete?: () => void;
}

export const OptimizedImage = memo(forwardRef<HTMLImageElement, OptimizedImageProps>(
  ({ 
    src, 
    alt, 
    width, 
    height, 
    priority = false,
    placeholder = 'empty',
    blurDataURL,
    fallbackSrc = '/images/placeholder.svg',
    onLoadComplete,
    className,
    ...props 
  }, ref) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [currentSrc, setCurrentSrc] = useState(placeholder === 'blur' && blurDataURL ? blurDataURL : src);
    const imgRef = useRef<HTMLImageElement>(null);

    const handleLoad = useCallback(() => {
      setIsLoaded(true);
      if (placeholder === 'blur' && currentSrc !== src) {
        setCurrentSrc(src);
      }
      onLoadComplete?.();
    }, [src, currentSrc, placeholder, onLoadComplete]);

    const handleError = useCallback(() => {
      setHasError(true);
      setCurrentSrc(fallbackSrc);
    }, [fallbackSrc]);

    // Intersection Observer for lazy loading
    useEffect(() => {
      if (priority || typeof window === 'undefined') return;

      const img = imgRef.current;
      if (!img) return;

      const observer = new IntersectionObserver(
        (entries) => {
          const [entry] = entries;
          if (entry.isIntersecting) {
            if (placeholder === 'blur' && blurDataURL && currentSrc === blurDataURL) {
              setCurrentSrc(src);
            }
            observer.disconnect();
          }
        },
        { rootMargin: '50px' }
      );

      observer.observe(img);
      return () => observer.disconnect();
    }, [priority, src, placeholder, blurDataURL, currentSrc]);

    return (
      <div className={cn("relative overflow-hidden", className)} style={{ width, height }}>
        <img
          ref={(node) => {
            imgRef.current = node;
            if (typeof ref === 'function') ref(node);
            else if (ref) ref.current = node;
          }}
          src={currentSrc}
          alt={alt}
          width={width}
          height={height}
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            "transition-opacity duration-300",
            isLoaded ? "opacity-100" : "opacity-0",
            hasError && "opacity-50"
          )}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          {...props}
        />
        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        )}
      </div>
    );
  }
));

OptimizedImage.displayName = 'OptimizedImage';

// Lazy-loaded Chart Component
const ChartComponent = lazy(() => import('recharts').then(module => ({
  default: module.ResponsiveContainer
})));

interface LazyChartProps {
  children: React.ReactNode;
  height?: number;
  fallback?: React.ReactNode;
}

export const LazyChart = memo<LazyChartProps>(({ 
  children, 
  height = 300, 
  fallback 
}) => (
  <Suspense 
    fallback={
      fallback || (
        <div className="flex items-center justify-center" style={{ height }}>
          <Skeleton className="w-full h-full" />
        </div>
      )
    }
  >
    <ChartComponent width="100%" height={height}>
      {children}
    </ChartComponent>
  </Suspense>
));

LazyChart.displayName = 'LazyChart';

// Memoized Table Component
interface OptimizedTableProps {
  data: any[];
  columns: Array<{
    key: string;
    label: string;
    render?: (value: any, row: any) -> React.ReactNode;
    sortable?: boolean;
  }>;
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
}

export const OptimizedTable = memo<OptimizedTableProps>(({ 
  data, 
  columns, 
  onSort,
  loading = false,
  emptyMessage = "No data available",
  className 
}) => {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = useCallback((column: string) => {
    const newDirection = sortColumn === column && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortColumn(column);
    setSortDirection(newDirection);
    onSort?.(column, newDirection);
  }, [sortColumn, sortDirection, onSort]);

  const TableRow = memo<{ row: any; index: number }>(({ row, index }) => (
    <tr key={index} className="hover:bg-gray-50 transition-colors">
      {columns.map((column) => (
        <td key={column.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          {column.render ? column.render(row[column.key], row) : row[column.key]}
        </td>
      ))}
    </tr>
  ));

  TableRow.displayName = 'TableRow';

  if (loading) {
    return (
      <Card className={className}>
        <div className="animate-pulse">
          <div className="h-12 bg-gray-200 rounded-t-lg"></div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 border-t"></div>
          ))}
        </div>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card className={cn("p-8 text-center", className)}>
        <p className="text-gray-500">{emptyMessage}</p>
      </Card>
    );
  }

  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",
                    column.sortable && "cursor-pointer hover:bg-gray-100"
                  )}
                  onClick={column.sortable ? () => handleSort(column.key) : undefined}
                >
                  <div className="flex items-center space-x-1">
                    <span>{column.label}</span>
                    {column.sortable && sortColumn === column.key && (
                      <span className="text-blue-500">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((row, index) => (
              <TableRow key={index} row={row} index={index} />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
});

OptimizedTable.displayName = 'OptimizedTable';

// Optimized Modal with portal and focus management
interface OptimizedModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closeOnOverlayClick?: boolean;
  showCloseButton?: boolean;
}

export const OptimizedModal = memo<OptimizedModalProps>(({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  closeOnOverlayClick = true,
  showCloseButton = true
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  };

  // Focus management
  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocusedElement = document.activeElement as HTMLElement;
    const modal = modalRef.current;
    
    if (modal) {
      const focusableElements = modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      firstElement?.focus();

      const handleTabKey = (e: KeyboardEvent) => {
        if (e.key === 'Tab') {
          if (e.shiftKey) {
            if (document.activeElement === firstElement) {
              lastElement?.focus();
              e.preventDefault();
            }
          } else {
            if (document.activeElement === lastElement) {
              firstElement?.focus();
              e.preventDefault();
            }
          }
        }
      };

      document.addEventListener('keydown', handleTabKey);
      return () => {
        document.removeEventListener('keydown', handleTabKey);
        previouslyFocusedElement?.focus();
      };
    }
  }, [isOpen]);

  // Escape key handling
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={closeOnOverlayClick ? onClose : undefined}
        />
        <Card 
          ref={modalRef}
          className={cn(
            "relative w-full transform overflow-hidden transition-all",
            sizeClasses[size]
          )}
        >
          {(title || showCloseButton) && (
            <div className="flex items-center justify-between p-6 border-b">
              {title && <h2 className="text-lg font-semibold">{title}</h2>}
              {showCloseButton && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="h-8 w-8 p-0"
                >
                  ×
                </Button>
              )}
            </div>
          )}
          <div className="p-6">
            {children}
          </div>
        </Card>
      </div>
    </div>
  );
});

OptimizedModal.displayName = 'OptimizedModal';

// Debounced Search Input
interface DebouncedSearchProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  delay?: number;
  className?: string;
}

export const DebouncedSearch = memo<DebouncedSearchProps>(({
  onSearch,
  placeholder = "Search...",
  delay = 300,
  className
}) => {
  const [query, setQuery] = useState('');
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      onSearch(query);
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [query, delay, onSearch]);

  return (
    <input
      type="text"
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      placeholder={placeholder}
      className={cn(
        "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
        className
      )}
    />
  );
});

DebouncedSearch.displayName = 'DebouncedSearch';