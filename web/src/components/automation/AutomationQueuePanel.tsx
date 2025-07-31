"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Clock,
  RotateCcw,
  Search,
  AlertTriangle,
  CheckCircle,
  GripVertical,
  Loader2,
  Circle,
  Activity,
  XCircle,
  X
} from "lucide-react";

import {
  QueuePanelProps as AutomationQueuePanelProps,
  QueueItem
} from "@/types/automation";

export function AutomationQueuePanel({
  userId,
  items: queueItems,
  onReorderItems: onUpdatePriority,
  onCancelItem,
  onRetryItem
}: AutomationQueuePanelProps) {
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragOverItem, setDragOverItem] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'>('all');
  const [filterType, setFilterType] = useState<'all' | 'connection' | 'engagement'>('all');
  const [filterPriority, setFilterPriority] = useState<'all' | 'low' | 'medium' | 'high' | 'urgent'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange] = useState<'1h' | '6h' | '24h' | '7d'>('24h');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // WebSocket connection for real-time queue updates
  useEffect(() => {
    if (!autoRefresh) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.hostname}:3007/automation/queue/${userId}`;
    
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('Queue monitoring WebSocket connected');
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'queue_update') {
          console.log('Queue update received:', data);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    return () => {
      ws.close();
    };
  }, [userId, autoRefresh]);

  // Advanced filtering logic
  const filteredItems = useMemo(() => {
    return queueItems.filter(item => {
      const matchesSearch = !searchQuery || 
        item.targetId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.targetName && item.targetName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        item.action.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = filterStatus === 'all' || item.status === filterStatus;
      const matchesType = filterType === 'all' || item.type === filterType;
      const matchesPriority = filterPriority === 'all' || item.priority === filterPriority;
      
      return matchesSearch && matchesStatus && matchesType && matchesPriority;
    });
  }, [queueItems, searchQuery, filterStatus, filterType, filterPriority]);

  // Enhanced queue statistics with time-based analytics
  const queueStats = useMemo(() => {
    const now = new Date();
    const timeRangeMs = {
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000
    }[timeRange];

    const recentItems = queueItems.filter(item => 
      now.getTime() - new Date(item.scheduledAt).getTime() <= timeRangeMs
    );

    const statusCounts = recentItems.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total: filteredItems.length,
      pending: statusCounts.pending || 0,
      processing: statusCounts.processing || 0,
      completed: statusCounts.completed || 0,
      failed: statusCounts.failed || 0,
      estimatedTimeRemaining: Math.round(statusCounts.pending * 2) // simplified calculation
    };
  }, [filteredItems, queueItems, timeRange]);

  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    setDraggedItem(itemId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, itemId: string) => {
    e.preventDefault();
    setDragOverItem(itemId);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverItem(null);
  };

  const handleDrop = async (e: React.DragEvent, targetItemId: string) => {
    e.preventDefault();
    
    if (!draggedItem || draggedItem === targetItemId) {
      setDraggedItem(null);
      setDragOverItem(null);
      return;
    }

    try {
      setLoading(true);
      
      const draggedIndex = queueItems.findIndex(item => item.id === draggedItem);
      const targetIndex = queueItems.findIndex(item => item.id === targetItemId);
      
      if (draggedIndex === -1 || targetIndex === -1) return;

      // Create reordered array and pass item IDs to onReorderItems  
      const reorderedItems = [...queueItems];
      const [draggedElement] = reorderedItems.splice(draggedIndex, 1);
      reorderedItems.splice(targetIndex, 0, draggedElement);
      
      await onUpdatePriority(reorderedItems.map(item => item.id));
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update priority');
    } finally {
      setLoading(false);
      setDraggedItem(null);
      setDragOverItem(null);
    }
  };

  const handleCancelItem = async (itemId: string) => {
    try {
      setLoading(true);
      await onCancelItem(itemId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel item');
    } finally {
      setLoading(false);
    }
  };

  const handleRetryItem = async (itemId: string) => {
    try {
      setLoading(true);
      await onRetryItem(itemId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retry item');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkCancel = async () => {
    if (selectedItems.length === 0) return;

    try {
      setLoading(true);
      // Bulk cancel - call onCancelItem for each selected item
      await Promise.all(selectedItems.map(itemId => onCancelItem(itemId)));
      setSelectedItems([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel selected items');
    } finally {
      setLoading(false);
    }
  };

  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const toggleSelectAll = () => {
    setSelectedItems(prev => 
      prev.length === filteredItems.length ? [] : filteredItems.map(item => item.id)
    );
  };

  const getStatusIcon = (status: QueueItem['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'cancelled':
        return <X className="h-4 w-4 text-gray-500" />;
      default:
        return <Circle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: QueueItem['status']) => {
    const config = {
      pending: { variant: "secondary" as const, label: "Pending", className: "bg-yellow-100 text-yellow-800" },
      processing: { variant: "default" as const, label: "Processing", className: "bg-blue-100 text-blue-800" },
      completed: { variant: "default" as const, label: "Completed", className: "bg-green-100 text-green-800" },
      failed: { variant: "destructive" as const, label: "Failed", className: "bg-red-100 text-red-800" },
      cancelled: { variant: "secondary" as const, label: "Cancelled", className: "bg-gray-100 text-gray-800" }
    };
    
    const statusConfig = config[status];
    return (
      <Badge variant={statusConfig.variant} className={statusConfig.className}>
        {getStatusIcon(status)}
        <span className="ml-1">{statusConfig.label}</span>
      </Badge>
    );
  };

  const getPriorityBadge = (priority: QueueItem['priority']) => {
    const config = {
      low: { label: "Low", className: "bg-gray-100 text-gray-800" },
      medium: { label: "Medium", className: "bg-blue-100 text-blue-800" },
      high: { label: "High", className: "bg-orange-100 text-orange-800" },
      urgent: { label: "Urgent", className: "bg-red-100 text-red-800" }
    };
    
    return (
      <Badge className={config[priority].className}>
        {config[priority].label}
      </Badge>
    );
  };

  const formatTime = (date: string | Date) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header with Stats Dashboard */}
      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">Automation Queue</h2>
            <p className="text-gray-600">Monitor and manage your automation tasks</p>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              <Activity className={`h-4 w-4 mr-2 ${autoRefresh ? 'text-green-500' : 'text-gray-400'}`} />
              {autoRefresh ? 'Live' : 'Paused'}
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-blue-600">{queueStats.total}</div>
              <p className="text-xs text-gray-500">Total Items</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-yellow-600">{queueStats.pending}</div>
              <p className="text-xs text-gray-500">Pending</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-blue-600">{queueStats.processing}</div>
              <p className="text-xs text-gray-500">Processing</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-600">{queueStats.completed}</div>
              <p className="text-xs text-gray-500">Completed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-red-600">{queueStats.failed}</div>
              <p className="text-xs text-gray-500">Failed</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex flex-col lg:flex-row gap-4 mb-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search queue items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as typeof filterStatus)}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterType} onValueChange={(value) => setFilterType(value as typeof filterType)}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="connection">Connection</SelectItem>
                <SelectItem value="engagement">Engagement</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterPriority} onValueChange={(value) => setFilterPriority(value as typeof filterPriority)}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedItems.length > 0 && (
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
            <span className="text-sm text-blue-700">
              {selectedItems.length} item{selectedItems.length !== 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleBulkCancel}
                disabled={loading}
              >
                Cancel Selected
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedItems([])}
              >
                Clear Selection
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Queue Items List */}
      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Queue Items ({filteredItems.length})</h3>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedItems.length === filteredItems.length && filteredItems.length > 0}
                onCheckedChange={toggleSelectAll}
              />
              <span className="text-sm text-gray-500">Select All</span>
            </div>
          </div>
        </div>

        <div className="divide-y">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No queue items found</h3>
              <p className="text-gray-500">
                {searchQuery || filterStatus !== 'all' || filterType !== 'all' || filterPriority !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'No automation tasks are currently queued'
                }
              </p>
            </div>
          ) : (
            filteredItems.map((item) => (
              <div
                key={item.id}
                className={`p-4 hover:bg-gray-50 transition-colors ${
                  dragOverItem === item.id ? 'bg-blue-50 border-blue-200' : ''
                } ${selectedItems.includes(item.id) ? 'bg-blue-50' : ''}`}
                draggable
                onDragStart={(e) => handleDragStart(e, item.id)}
                onDragOver={(e) => handleDragOver(e, item.id)}
                onDragEnd={handleDragEnd}
                onDrop={(e) => handleDrop(e, item.id)}
              >
                <div className="flex items-center space-x-4">
                  <Checkbox
                    checked={selectedItems.includes(item.id)}
                    onCheckedChange={() => toggleItemSelection(item.id)}
                  />
                  
                  <div className="cursor-move">
                    <GripVertical className="h-4 w-4 text-gray-400" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-sm">{item.type}</span>
                        {getStatusBadge(item.status)}
                        {getPriorityBadge(item.priority)}
                      </div>
                      <span className="text-xs text-gray-500">
                        {formatTime(item.scheduledAt)}
                      </span>
                    </div>

                    <div className="text-sm text-gray-600 mb-2">
                      Target: <span className="font-medium">{item.targetId}</span>
                      {item.metadata && (
                        <span className="ml-2">
                          Action: <span className="italic">{item.action}</span>
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-gray-500">
                      Scheduled: {formatTime(item.scheduledAt)}
                      {item.lastError && (
                        <span className="ml-2 text-red-600">
                          Error: {item.lastError}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {item.status === 'failed' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRetryItem(item.id)}
                        disabled={loading}
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Retry
                      </Button>
                    )}
                    
                    {(item.status === 'pending' || item.status === 'processing') && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCancelItem(item.id)}
                        disabled={loading}
                      >
                        <X className="h-3 w-3 mr-1" />
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Queue Progress */}
        {queueStats.pending > 0 && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Queue Progress</span>
              <span className="text-sm text-gray-500">
                {queueStats.completed + queueStats.failed} of {queueStats.total} completed
              </span>
            </div>
            <Progress 
              value={((queueStats.completed + queueStats.failed) / queueStats.total) * 100} 
              className="h-2"
            />
            <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
              <span>Estimated completion: {Math.round(queueStats.estimatedTimeRemaining)} minutes</span>
              <span>Success rate: {queueStats.total > 0 ? Math.round((queueStats.completed / (queueStats.completed + queueStats.failed || 1)) * 100) : 0}%</span>
            </div>
          </div>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}