import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-gray-200", className)}
      {...props}
    />
  )
}

// Specific skeleton components for dashboard elements
export const ProfileCompletnessSkeleton = () => (
  <div className="space-y-6">
    {/* Overall Score Card */}
    <div className="border rounded-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-6 w-40" />
        </div>
        <div className="flex items-center space-x-2">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      </div>
      
      <div className="space-y-2">
        <Skeleton className="h-3 w-full rounded-full" />
        <div className="flex justify-between">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-3 w-8" />)}
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
        {[1, 2, 3].map(i => (
          <div key={i} className="text-center space-y-2">
            <Skeleton className="h-4 w-16 mx-auto" />
            <Skeleton className="h-6 w-12 mx-auto" />
          </div>
        ))}
      </div>
    </div>
    
    {/* Detailed Breakdown */}
    <div className="border rounded-lg p-6">
      <div className="flex items-center space-x-2 mb-4">
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-6 w-32" />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="p-4 border rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Skeleton className="h-6 w-6 rounded" />
                <Skeleton className="h-5 w-24" />
              </div>
              <div className="space-y-1">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-3 w-8" />
              </div>
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>
    </div>
    
    {/* Priority Improvements */}
    <div className="border rounded-lg p-6">
      <div className="flex items-center space-x-2 mb-4">
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-6 w-40" />
      </div>
      
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-start space-x-3 p-4 border rounded-lg">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-32" />
                <div className="flex items-center space-x-2">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>
              <Skeleton className="h-4 w-full" />
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-24 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export const MetricsWidgetSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
    {[1, 2, 3, 4].map(i => (
      <div key={i} className="border rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
    ))}
  </div>
);

export const AnalyticsChartSkeleton = () => (
  <div className="border rounded-lg p-6 space-y-4">
    <div className="flex items-center justify-between">
      <Skeleton className="h-6 w-40" />
      <div className="flex space-x-2">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-8 w-16 rounded" />
        ))}
      </div>
    </div>
    <Skeleton className="h-64 w-full rounded" />
  </div>
);

export { Skeleton }