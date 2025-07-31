"use client";

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  Clock,
  AlertTriangle,
  CheckCircle,
  Pause,
  Play,
  Settings,
  MoreVertical
} from 'lucide-react';
import { theme } from '../theme';
import { cn } from '@/lib/utils';

// Enhanced automation card component with performance optimizations
interface AutomationCardProps {
  title: string;
  value: string | number;
  description?: string;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  status?: 'active' | 'paused' | 'error' | 'warning';
  progress?: number;
  icon?: React.ElementType;
  children?: React.ReactNode;
  className?: string;
  actions?: {
    label: string;
    onClick: () => void;
    variant?: 'default' | 'outline' | 'ghost';
    icon?: React.ElementType;
  }[];
  onClick?: () => void;
  isLoading?: boolean;
  urgent?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const STATUS_STYLES = {
  active: {
    badge: 'bg-green-100 text-green-800 border-green-200',
    indicator: 'bg-green-500',
    ring: 'ring-green-500/20',
  },
  paused: {
    badge: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    indicator: 'bg-yellow-500',
    ring: 'ring-yellow-500/20',
  },
  error: {
    badge: 'bg-red-100 text-red-800 border-red-200',
    indicator: 'bg-red-500',
    ring: 'ring-red-500/20',
  },
  warning: {
    badge: 'bg-orange-100 text-orange-800 border-orange-200',
    indicator: 'bg-orange-500',
    ring: 'ring-orange-500/20',
  },
};

const SIZE_STYLES = {
  sm: {
    card: 'p-3',
    title: 'text-sm',
    value: 'text-lg',
    description: 'text-xs',
  },
  md: {
    card: 'p-4',
    title: 'text-base',
    value: 'text-2xl',
    description: 'text-sm',
  },
  lg: {
    card: 'p-6',
    title: 'text-lg',
    value: 'text-3xl',
    description: 'text-base',
  },
};

export function AutomationCard({
  title,
  value,
  description,
  trend,
  trendValue,
  status = 'active',
  progress,
  icon: Icon = Activity,
  children,
  className,
  actions = [],
  onClick,
  isLoading = false,
  urgent = false,
  size = 'md',
}: AutomationCardProps) {
  const statusStyles = STATUS_STYLES[status];
  const sizeStyles = SIZE_STYLES[size];
  
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Activity;
  const StatusIcon = status === 'active' ? CheckCircle : 
                    status === 'paused' ? Pause : 
                    status === 'error' ? AlertTriangle : 
                    Clock;

  return (
    <Card 
      className={cn(
        "group relative transition-all duration-200 hover:shadow-md",
        urgent && "ring-2 ring-red-500/50 animate-pulse",
        onClick && "cursor-pointer hover:scale-[1.02]",
        isLoading && "opacity-60",
        className
      )}
      onClick={onClick}
    >
      {/* Status Indicator */}
      <div className={cn("absolute top-2 right-2 w-2 h-2 rounded-full", statusStyles.indicator)} />
      
      <CardContent className={sizeStyles.card}>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-lg bg-primary/10",
              status === 'error' && "bg-red-50",
              status === 'warning' && "bg-yellow-50",
              status === 'paused' && "bg-gray-50"
            )}>
              <Icon className={cn(
                "h-4 w-4",
                status === 'active' && "text-primary",
                status === 'error' && "text-red-600",
                status === 'warning' && "text-yellow-600",
                status === 'paused' && "text-gray-600"
              )} />
            </div>
            
            <div>
              <h3 className={cn("font-semibold text-gray-900", sizeStyles.title)}>
                {title}
              </h3>
              {description && (
                <p className={cn("text-gray-500", sizeStyles.description)}>
                  {description}
                </p>
              )}
            </div>
          </div>
          
          {actions.length > 0 && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {actions.slice(0, 2).map((action, index) => {
                const ActionIcon = action.icon;
                return (
                  <Button
                    key={index}
                    variant={action.variant || 'ghost'}
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      action.onClick();
                    }}
                  >
                    {ActionIcon && <ActionIcon className="h-3 w-3 mr-1" />}
                    {action.label}
                  </Button>
                );
              })}
              
              {actions.length > 2 && (
                <Button variant="ghost" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Value and Trend */}
        <div className="flex items-end justify-between mb-3">
          <div className={cn("font-bold text-gray-900", sizeStyles.value)}>
            {isLoading ? (
              <div className="animate-pulse bg-gray-200 h-8 w-16 rounded" />
            ) : (
              value
            )}
          </div>
          
          {trend && trendValue && (
            <div className={cn(
              "flex items-center gap-1 text-sm font-medium",
              trend === 'up' && "text-green-600",
              trend === 'down' && "text-red-600",
              trend === 'stable' && "text-gray-500"
            )}>
              <TrendIcon className="h-3 w-3" />
              <span>{trendValue}</span>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        {progress !== undefined && (
          <div className="mb-3">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Progress</span>
              <span>{progress.toFixed(0)}%</span>
            </div>
            <Progress 
              value={progress} 
              className={cn(
                "h-2",
                status === 'error' && "data-[state=complete]:bg-red-500",
                status === 'warning' && "data-[state=complete]:bg-yellow-500"
              )} 
            />
          </div>
        )}

        {/* Status Badge */}
        <div className="flex items-center justify-between">
          <Badge className={cn("text-xs", statusStyles.badge)}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {status.toUpperCase()}
          </Badge>
          
          {urgent && (
            <Badge variant="destructive" className="text-xs animate-pulse">
              URGENT
            </Badge>
          )}
        </div>

        {/* Custom Children */}
        {children && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            {children}
          </div>
        )}
      </CardContent>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-white/50 flex items-center justify-center rounded-lg">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </Card>
  );
}

// Specialized automation metric card
interface MetricCardProps {
  title: string;
  current: number;
  limit: number;
  unit?: string;
  status?: 'safe' | 'warning' | 'critical';
  trend?: number; // percentage change
  className?: string;
}

export function MetricCard({
  title,
  current,
  limit,
  unit = '',
  status = 'safe',
  trend,
  className
}: MetricCardProps) {
  const percentage = Math.min((current / limit) * 100, 100);
  
  const statusColors = {
    safe: 'text-green-600 bg-green-50 border-green-200',
    warning: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    critical: 'text-red-600 bg-red-50 border-red-200',
  };

  return (
    <AutomationCard
      title={title}
      value={`${current}${unit}`}
      description={`of ${limit}${unit} daily limit`}
      progress={percentage}
      status={status === 'safe' ? 'active' : status === 'warning' ? 'warning' : 'error'}
      trend={trend ? (trend > 0 ? 'up' : trend < 0 ? 'down' : 'stable') : undefined}
      trendValue={trend ? `${Math.abs(trend).toFixed(1)}%` : undefined}
      className={cn(statusColors[status], className)}
      size="sm"
    >
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-gray-500">Usage:</span>
          <span className="ml-1 font-medium">{percentage.toFixed(1)}%</span>
        </div>
        <div>
          <span className="text-gray-500">Remaining:</span>
          <span className="ml-1 font-medium">{limit - current}{unit}</span>
        </div>
      </div>
    </AutomationCard>
  );
}

// Quick action card for common automation tasks
interface QuickActionCardProps {
  title: string;
  description: string;
  icon: React.ElementType;
  onClick: () => void;
  disabled?: boolean;
  badge?: string;
  className?: string;
}

export function QuickActionCard({
  title,
  description,
  icon: Icon,
  onClick,
  disabled = false,
  badge,
  className
}: QuickActionCardProps) {
  return (
    <Card 
      className={cn(
        "group cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.02]",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      onClick={disabled ? undefined : onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900">{title}</h3>
              {badge && (
                <Badge variant="secondary" className="text-xs">
                  {badge}
                </Badge>
              )}
            </div>
            <p className="text-sm text-gray-500">{description}</p>
          </div>
          
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="sm">
              <Play className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}