/**
 * Enhanced Skeleton Components for Loading States
 * Comprehensive skeleton loaders with animations and intelligent sizing
 */

'use client';

import React from 'react';
import { cn } from '@/lib/utils';

// Base Skeleton Component
export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  animate?: boolean;
  variant?: 'default' | 'circular' | 'rectangular' | 'text' | 'rounded';
  width?: string | number;
  height?: string | number;
}

export function Skeleton({
  className,
  animate = true,
  variant = 'default',
  width,
  height,
  style,
  ...props
}: SkeletonProps) {
  const baseClasses = 'bg-muted';
  const animationClasses = animate ? 'animate-pulse' : '';
  
  const variantClasses = {
    default: 'rounded-md',
    circular: 'rounded-full',
    rectangular: 'rounded-none',
    text: 'rounded-sm h-4',
    rounded: 'rounded-lg',
  };

  const combinedStyle = {
    width,
    height,
    ...style,
  };

  return (
    <div
      className={cn(
        baseClasses,
        animationClasses,
        variantClasses[variant],
        className
      )}
      style={combinedStyle}
      {...props}
    />
  );
}

// Card Skeleton Component
export interface CardSkeletonProps {
  className?: string;
  showHeader?: boolean;
  showAvatar?: boolean;
  contentLines?: number;
  showActions?: boolean;
  animate?: boolean;
}

export function CardSkeleton({
  className,
  showHeader = true,
  showAvatar = false,
  contentLines = 3,
  showActions = false,
  animate = true,
}: CardSkeletonProps) {
  return (
    <div className={cn('border rounded-lg p-6 space-y-4', className)}>
      {showHeader && (
        <div className="flex items-center space-x-4">
          {showAvatar && (
            <Skeleton
              variant="circular"
              width={40}
              height={40}
              animate={animate}
            />
          )}
          <div className="space-y-2 flex-1">
            <Skeleton
              width="60%"
              height={20}
              animate={animate}
            />
            <Skeleton
              width="40%"
              height={16}
              animate={animate}
            />
          </div>
        </div>
      )}
      
      <div className="space-y-3">
        {Array.from({ length: contentLines }).map((_, i) => (
          <Skeleton
            key={i}
            width={i === contentLines - 1 ? '75%' : '100%'}
            height={16}
            animate={animate}
          />
        ))}
      </div>

      {showActions && (
        <div className="flex space-x-2 pt-2">
          <Skeleton width={80} height={32} animate={animate} />
          <Skeleton width={100} height={32} animate={animate} />
        </div>
      )}
    </div>
  );
}

// Chart Skeleton Component
export interface ChartSkeletonProps {
  className?: string;
  height?: number;
  showLegend?: boolean;
  showAxes?: boolean;
  animate?: boolean;
}

export function ChartSkeleton({
  className,
  height = 300,
  showLegend = true,
  showAxes = true,
  animate = true,
}: ChartSkeletonProps) {
  return (
    <div className={cn('border rounded-lg p-6', className)}>
      {/* Chart Title */}
      <div className="mb-4">
        <Skeleton width="30%" height={24} animate={animate} />
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="flex space-x-6 mb-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center space-x-2">
              <Skeleton variant="circular" width={12} height={12} animate={animate} />
              <Skeleton width={60} height={16} animate={animate} />
            </div>
          ))}
        </div>
      )}

      {/* Chart Area */}
      <div className="relative" style={{ height }}>
        {/* Y-Axis */}
        {showAxes && (
          <div className="absolute left-0 top-0 bottom-8 w-12 space-y-4 flex flex-col justify-between">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} width={40} height={12} animate={animate} />
            ))}
          </div>
        )}

        {/* Chart Bars/Lines */}
        <div className="ml-14 mr-4 h-full relative">
          <div className="absolute inset-0 flex items-end justify-between space-x-2">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton
                key={i}
                width="100%"
                height={`${Math.random() * 80 + 20}%`}
                animate={animate}
                className="flex-1"
              />
            ))}
          </div>
        </div>

        {/* X-Axis */}
        {showAxes && (
          <div className="absolute bottom-0 left-14 right-4 flex justify-between">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} width={40} height={12} animate={animate} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Metrics Widget Skeleton
export interface MetricsWidgetSkeletonProps {
  className?: string;
  showIcon?: boolean;
  showTrend?: boolean;
  animate?: boolean;
}

export function MetricsWidgetSkeleton({
  className,
  showIcon = true,
  showTrend = true,
  animate = true,
}: MetricsWidgetSkeletonProps) {
  return (
    <div className={cn('border rounded-lg p-6', className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          {showIcon && (
            <Skeleton
              variant="circular"
              width={32}
              height={32}
              animate={animate}
            />
          )}
          <Skeleton width={120} height={16} animate={animate} />
        </div>
        {showTrend && (
          <Skeleton width={60} height={20} animate={animate} />
        )}
      </div>
      
      <div className="space-y-2">
        <Skeleton width="60%" height={32} animate={animate} />
        <Skeleton width="40%" height={16} animate={animate} />
      </div>
    </div>
  );
}

// Table Skeleton Component
export interface TableSkeletonProps {
  className?: string;
  rows?: number;
  columns?: number;
  showHeader?: boolean;
  animate?: boolean;
}

export function TableSkeleton({
  className,
  rows = 5,
  columns = 4,
  showHeader = true,
  animate = true,
}: TableSkeletonProps) {
  return (
    <div className={cn('border rounded-lg overflow-hidden', className)}>
      {showHeader && (
        <div className="bg-muted/50 p-4 border-b">
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
            {Array.from({ length: columns }).map((_, i) => (
              <Skeleton key={i} width="80%" height={16} animate={animate} />
            ))}
          </div>
        </div>
      )}
      
      <div className="divide-y">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="p-4">
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
              {Array.from({ length: columns }).map((_, colIndex) => (
                <Skeleton
                  key={colIndex}
                  width={`${Math.random() * 40 + 60}%`}
                  height={16}
                  animate={animate}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// List Skeleton Component
export interface ListSkeletonProps {
  className?: string;
  items?: number;
  showAvatar?: boolean;
  showMetadata?: boolean;
  showActions?: boolean;
  animate?: boolean;
}

export function ListSkeleton({
  className,
  items = 5,
  showAvatar = true,
  showMetadata = true,
  showActions = false,
  animate = true,
}: ListSkeletonProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
          {showAvatar && (
            <Skeleton
              variant="circular"
              width={48}
              height={48}
              animate={animate}
            />
          )}
          
          <div className="flex-1 space-y-2">
            <Skeleton width="70%" height={18} animate={animate} />
            {showMetadata && (
              <div className="space-y-1">
                <Skeleton width="50%" height={14} animate={animate} />
                <Skeleton width="30%" height={14} animate={animate} />
              </div>
            )}
          </div>

          {showActions && (
            <div className="flex space-x-2">
              <Skeleton width={32} height={32} animate={animate} />
              <Skeleton width={32} height={32} animate={animate} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Dashboard Skeleton
export interface DashboardSkeletonProps {
  className?: string;
  animate?: boolean;
}

export function DashboardSkeleton({
  className,
  animate = true,
}: DashboardSkeletonProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="space-y-2">
        <Skeleton width="40%" height={32} animate={animate} />
        <Skeleton width="60%" height={16} animate={animate} />
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <MetricsWidgetSkeleton key={i} animate={animate} />
        ))}
      </div>

      {/* Chart Section */}
      <ChartSkeleton height={400} animate={animate} />

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CardSkeleton contentLines={5} showActions animate={animate} />
        <ListSkeleton items={3} animate={animate} />
      </div>
    </div>
  );
}

// Automation Dashboard Skeleton
export function AutomationDashboardSkeleton({
  className,
  animate = true,
}: DashboardSkeletonProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Header with Status */}
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <Skeleton width="300px" height={32} animate={animate} />
          <Skeleton width="400px" height={16} animate={animate} />
        </div>
        <div className="flex items-center space-x-4">
          <Skeleton variant="circular" width={24} height={24} animate={animate} />
          <Skeleton width={80} height={32} animate={animate} />
          <Skeleton width={100} height={32} animate={animate} />
        </div>
      </div>

      {/* Safety Status Alert */}
      <div className="border border-orange-200 bg-orange-50 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          <Skeleton variant="circular" width={20} height={20} animate={animate} />
          <Skeleton width="60%" height={16} animate={animate} />
        </div>
      </div>

      {/* Safety Monitor Widget */}
      <div className="border rounded-lg p-6 space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton width="200px" height={20} animate={animate} />
          <Skeleton width={80} height={24} animate={animate} />
        </div>
        
        {/* Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="text-center space-y-2">
              <Skeleton width="100%" height={16} animate={animate} />
              <Skeleton width="60%" height={24} animate={animate} className="mx-auto" />
              <Skeleton width="80%" height={12} animate={animate} className="mx-auto" />
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="space-y-4">
        <div className="flex space-x-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} width={120} height={36} animate={animate} />
          ))}
        </div>

        {/* Tab Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <CardSkeleton showHeader contentLines={4} showActions animate={animate} />
            <ListSkeleton items={3} showAvatar={false} animate={animate} />
          </div>
          
          <div className="space-y-4">
            <MetricsWidgetSkeleton showTrend animate={animate} />
            <TableSkeleton rows={5} columns={3} animate={animate} />
          </div>
        </div>
      </div>
    </div>
  );
}

// Profile Completeness Skeleton
export function ProfileCompletenessSkeletonProps({
  className,
  animate = true,
}: DashboardSkeletonProps) {
  return (
    <div className={cn('border rounded-lg p-6', className)}>
      <div className="flex justify-between items-center mb-6">
        <Skeleton width="250px" height={24} animate={animate} />
        <Skeleton width={60} height={20} animate={animate} />
      </div>

      {/* Progress Circle */}
      <div className="flex items-center justify-center mb-6">
        <Skeleton variant="circular" width={120} height={120} animate={animate} />
      </div>

      {/* Completion Items */}
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Skeleton variant="circular" width={20} height={20} animate={animate} />
              <Skeleton width={`${Math.random() * 100 + 100}px`} height={16} animate={animate} />
            </div>
            <Skeleton width={80} height={16} animate={animate} />
          </div>
        ))}
      </div>
    </div>
  );
}

// Analytics Chart Skeleton
export interface AnalyticsChartSkeletonProps {
  className?: string;
  animate?: boolean;
}

export function AnalyticsChartSkeleton({
  className,
  animate = true,
}: AnalyticsChartSkeletonProps) {
  return (
    <div className={cn('border rounded-lg p-6', className)}>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="space-y-2">
          <Skeleton width="200px" height={24} animate={animate} />
          <Skeleton width="300px" height={16} animate={animate} />
        </div>
        <div className="flex space-x-2">
          <Skeleton width={80} height={32} animate={animate} />
          <Skeleton width={100} height={32} animate={animate} />
          <Skeleton width={32} height={32} animate={animate} />
        </div>
      </div>

      {/* Metrics Toggles */}
      <div className="flex flex-wrap gap-2 mb-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} width={120} height={28} animate={animate} />
        ))}
      </div>

      {/* Chart */}
      <ChartSkeleton height={400} showLegend={false} animate={animate} />
    </div>
  );
}

export default Skeleton;