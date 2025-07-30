"use client";

import React, { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Clock,
  Users,
  Heart,
  MessageSquare,
  Eye,
  Target,
  ArrowUp,
  ArrowDown,
  Play,
  Pause,
  RotateCcw,
  Trash2,
  Filter,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Calendar,
  MoreHorizontal,
  GripVertical,
  Zap
} from "lucide-react";

import { QueueItem } from "@/types/automation";

interface EnhancedQueueManagerProps {
  userId: string;
  queueItems: QueueItem[];
  onUpdatePriority: (itemId: string, priority: 'low' | 'medium' | 'high') => Promise<void>;
  onCancelItem: (itemId: string) => Promise<void>;
  onRetryItem: (itemId: string) => Promise<void>;
  onBulkAction: (action: string, itemIds: string[]) => Promise<void>;
  subscriptionTier: 'free' | 'premium' | 'enterprise';
}

export function EnhancedQueueManager({
  userId,
  queueItems,
  onUpdatePriority,
  onCancelItem,
  onRetryItem,
  onBulkAction,
  subscriptionTier
}: EnhancedQueueManagerProps) {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('scheduledAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragOverItem, setDragOverItem] = useState<string | null>(null);

  // Filter and sort queue items
  const filteredAndSortedItems = useMemo(() => {
    let filtered = queueItems;

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(item => item.status === filterStatus);
    }

    // Apply type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(item => item.type === filterType);
    }

    // Sort items
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortBy) {
        case 'scheduledAt':
          aValue = new Date(a.scheduledAt).getTime();
          bValue = new Date(b.scheduledAt).getTime();
          break;
        case 'priority':
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          aValue = priorityOrder[a.priority];
          bValue = priorityOrder[b.priority];
          break;
        case 'type':
          aValue = a.type;
          bValue = b.type;
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        default:
          aValue = a[sortBy as keyof QueueItem];
          bValue = b[sortBy as keyof QueueItem];
      }

      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  }, [queueItems, filterStatus, filterType, sortBy, sortOrder]);

  // Queue statistics
  const queueStats = useMemo(() => {
    const stats = {
      total: queueItems.length,
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      byType: {
        connection: 0,
        engagement: 0
      },
      avgWaitTime: 0,
      nextExecution: null as Date | null
    };

    queueItems.forEach(item => {
      stats[item.status as keyof typeof stats]++;
      stats.byType[item.type as keyof typeof stats.byType]++;
    });

    // Calculate average wait time for pending items
    const pendingItems = queueItems.filter(item => item.status === 'pending');
    if (pendingItems.length > 0) {
      const totalWaitTime = pendingItems.reduce((sum, item) => {
        return sum + (new Date(item.scheduledAt).getTime() - new Date().getTime());
      }, 0);
      stats.avgWaitTime = Math.max(0, Math.round(totalWaitTime / pendingItems.length / 1000 / 60)); // minutes
    }

    // Find next execution time
    const nextItem = pendingItems
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())[0];
    if (nextItem) {
      stats.nextExecution = new Date(nextItem.scheduledAt);
    }

    return stats;
  }, [queueItems]);

  // Item selection handlers
  const handleSelectItem = useCallback((itemId: string, selected: boolean) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(itemId);
      } else {
        newSet.delete(itemId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback((selected: boolean) => {
    if (selected) {
      setSelectedItems(new Set(filteredAndSortedItems.map(item => item.id)));
    } else {
      setSelectedItems(new Set());
    }
  }, [filteredAndSortedItems]);

  // Bulk action handlers
  const handleBulkAction = useCallback(async (action: string) => {
    if (selectedItems.size === 0) return;
    
    try {
      await onBulkAction(action, Array.from(selectedItems));
      setSelectedItems(new Set());
    } catch (error) {
      console.error('Bulk action failed:', error);
    }
  }, [selectedItems, onBulkAction]);

  // Drag and drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, itemId: string) => {
    setDraggedItem(itemId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, itemId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverItem(itemId);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverItem(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, targetItemId: string) => {
    e.preventDefault();
    
    if (!draggedItem || draggedItem === targetItemId) {
      setDraggedItem(null);
      setDragOverItem(null);
      return;
    }

    // In a real implementation, you'd reorder the items here
    // For now, we'll just clear the drag state
    setDraggedItem(null);
    setDragOverItem(null);
  }, [draggedItem]);

  // Helper functions
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-blue-600 bg-blue-50';
      case 'processing': return 'text-yellow-600 bg-yellow-50';
      case 'completed': return 'text-green-600 bg-green-50';
      case 'failed': return 'text-red-600 bg-red-50';
      case 'cancelled': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getTypeIcon = (type: string, action: string) => {
    if (type === 'connection') return <Users className="h-4 w-4" />;
    if (action === 'like') return <Heart className="h-4 w-4" />;
    if (action === 'comment') return <MessageSquare className="h-4 w-4" />;
    if (action === 'view_profile') return <Eye className="h-4 w-4" />;
    if (action === 'follow') return <Target className="h-4 w-4" />;
    return <Activity className="h-4 w-4" />;
  };

  const formatTimeRemaining = (scheduledAt: Date) => {
    const now = new Date();
    const scheduled = new Date(scheduledAt);
    const diff = scheduled.getTime() - now.getTime();
    
    if (diff <= 0) return 'Overdue';
    
    const minutes = Math.floor(diff / 1000 / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  };

  return (
    <div className="space-y-6">
      {/* Queue Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-blue-500" />
              <div>
                <div className="text-2xl font-bold">{queueStats.total}</div>
                <div className="text-xs text-gray-600">Total Items</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Play className="h-5 w-5 text-green-500" />
              <div>
                <div className="text-2xl font-bold">{queueStats.pending}</div>
                <div className="text-xs text-gray-600">Pending</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Activity className="h-5 w-5 text-yellow-500" />
              <div>
                <div className="text-2xl font-bold">{queueStats.processing}</div>
                <div className="text-xs text-gray-600">Processing</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <div className="text-2xl font-bold">{queueStats.completed}</div>
                <div className="text-xs text-gray-600">Completed</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <XCircle className="h-5 w-5 text-red-500" />
              <div>
                <div className="text-2xl font-bold">{queueStats.failed}</div>
                <div className="text-xs text-gray-600">Failed</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-purple-500" />
              <div>
                <div className="text-lg font-bold">
                  {queueStats.avgWaitTime > 0 ? `${queueStats.avgWaitTime}m` : '-'}
                </div>
                <div className="text-xs text-gray-600">Avg Wait</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Next Execution Alert */}
      {queueStats.nextExecution && (
        <Alert className="border-blue-200 bg-blue-50">
          <Clock className="h-4 w-4 text-blue-600" />
          <AlertDescription>
            Next automation scheduled for{' '}
            <span className="font-medium">
              {queueStats.nextExecution.toLocaleString()}
            </span>
            {' '}({formatTimeRemaining(queueStats.nextExecution)})
          </AlertDescription>
        </Alert>
      )}

      {/* Main Queue Manager */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="h-5 w-5" />
                <span>Automation Queue</span>
                <Badge variant="outline">{filteredAndSortedItems.length}</Badge>
              </CardTitle>
              <CardDescription>
                Manage and monitor your automation queue with drag-and-drop prioritization
              </CardDescription>
            </div>
            
            {/* Bulk Actions */}
            {selectedItems.size > 0 && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">
                  {selectedItems.size} selected
                </span>
                <Button
                  onClick={() => handleBulkAction('cancel')}
                  size="sm"
                  variant="outline"
                >
                  Cancel Selected
                </Button>
                <Button
                  onClick={() => handleBulkAction('retry')}
                  size="sm"
                  variant="outline"
                >
                  Retry Selected
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters and Controls */}
          <div className="flex flex-wrap items-center gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-2">
              <Checkbox
                checked={selectedItems.size === filteredAndSortedItems.length && filteredAndSortedItems.length > 0}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm font-medium">Select All</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <Select value={filterStatus} onValueChange={setFilterStatus}>
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
            </div>
            
            <div className="flex items-center space-x-2">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="connection">Connections</SelectItem>
                  <SelectItem value="engagement">Engagement</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center space-x-2">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduledAt">Schedule</SelectItem>
                  <SelectItem value="priority">Priority</SelectItem>
                  <SelectItem value="type">Type</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              size="sm"
              variant="outline"
            >
              {sortOrder === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
            </Button>
          </div>

          {/* Queue Items */}
          <div className="space-y-2">
            {filteredAndSortedItems.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>No queue items match your current filters</p>
              </div>
            ) : (
              filteredAndSortedItems.map((item) => (
                <div
                  key={item.id}
                  draggable={subscriptionTier !== 'free'}
                  onDragStart={(e) => handleDragStart(e, item.id)}
                  onDragOver={(e) => handleDragOver(e, item.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, item.id)}
                  className={`
                    border rounded-lg p-4 transition-all duration-200
                    ${dragOverItem === item.id ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}
                    ${selectedItems.has(item.id) ? 'bg-blue-50 border-blue-300' : 'bg-white'}
                    ${subscriptionTier !== 'free' ? 'cursor-move' : ''}
                  `}
                >
                  <div className="flex items-center space-x-4">
                    {/* Drag Handle */}
                    {subscriptionTier !== 'free' && (
                      <GripVertical className="h-4 w-4 text-gray-400" />
                    )}
                    
                    {/* Selection Checkbox */}
                    <Checkbox
                      checked={selectedItems.has(item.id)}
                      onCheckedChange={(checked) => handleSelectItem(item.id, checked as boolean)}
                    />
                    
                    {/* Item Icon */}
                    <div className="flex-shrink-0">
                      {getTypeIcon(item.type, item.action)}
                    </div>
                    
                    {/* Item Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="font-medium text-sm">
                          {item.action.replace('_', ' ').charAt(0).toUpperCase() + item.action.slice(1)}
                        </span>
                        
                        <Badge className={`text-xs ${getPriorityColor(item.priority)}`}>
                          {item.priority}
                        </Badge>
                        
                        <Badge className={`text-xs ${getStatusColor(item.status)}`}>
                          {item.status}
                        </Badge>
                        
                        {item.retryCount > 0 && (
                          <Badge variant="outline" className="text-xs">
                            Retry {item.retryCount}/{item.maxRetries}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="text-sm text-gray-600">
                        {item.targetName && (
                          <span className="font-medium">{item.targetName}</span>
                        )}
                        {item.targetName && ' • '}
                        Scheduled: {new Date(item.scheduledAt).toLocaleString()}
                        {item.status === 'pending' && (
                          <span className="ml-2 text-blue-600">
                            ({formatTimeRemaining(item.scheduledAt)})
                          </span>
                        )}
                      </div>
                      
                      {item.lastError && (
                        <div className="text-sm text-red-600 mt-1">
                          Error: {item.lastError}
                        </div>
                      )}
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex items-center space-x-2">
                      {item.status === 'pending' && (
                        <Select
                          value={item.priority}
                          onValueChange={(priority) => 
                            onUpdatePriority(item.id, priority as 'low' | 'medium' | 'high')
                          }
                        >
                          <SelectTrigger className="w-20 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="low">Low</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      
                      {item.status === 'failed' && (
                        <Button
                          onClick={() => onRetryItem(item.id)}
                          size="sm"
                          variant="outline"
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Retry
                        </Button>
                      )}
                      
                      {(item.status === 'pending' || item.status === 'failed') && (
                        <Button
                          onClick={() => onCancelItem(item.id)}
                          size="sm"
                          variant="outline"
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Cancel
                        </Button>
                      )}
                      
                      <Button
                        onClick={() => {
                          const expanded = new Set(expandedItems);
                          if (expanded.has(item.id)) {
                            expanded.delete(item.id);
                          } else {
                            expanded.add(item.id);
                          }
                          setExpandedItems(expanded);
                        }}
                        size="sm"
                        variant="outline"
                      >
                        {expandedItems.has(item.id) ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  {/* Expanded Details */}
                  {expandedItems.has(item.id) && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="font-medium text-gray-700">Target ID</div>
                          <div className="text-gray-600">{item.targetId}</div>
                        </div>
                        <div>
                          <div className="font-medium text-gray-700">Created</div>
                          <div className="text-gray-600">
                            {new Date(item.metadata?.createdAt || Date.now()).toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div className="font-medium text-gray-700">Duration</div>
                          <div className="text-gray-600">
                            {item.estimatedDuration ? `${item.estimatedDuration}s` : 'Unknown'}
                          </div>
                        </div>
                        <div>
                          <div className="font-medium text-gray-700">Progress</div>
                          <div className="text-gray-600">
                            {item.status === 'processing' ? (
                              <Progress value={50} className="w-full h-2 mt-1" />
                            ) : (
                              item.status
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {item.metadata && Object.keys(item.metadata).length > 0 && (
                        <div className="mt-3">
                          <div className="font-medium text-gray-700 mb-2">Metadata</div>
                          <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                            {JSON.stringify(item.metadata, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Subscription Upgrade */}
      {subscriptionTier === 'free' && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-lg text-blue-700">
              <Zap className="h-5 w-5" />
              <span>Upgrade for Advanced Queue Management</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-blue-600 space-y-2">
              <p>Premium features include:</p>
              <ul className="space-y-1 ml-4">
                <li>• Drag-and-drop queue reordering</li>
                <li>• Advanced filtering and sorting options</li>
                <li>• Bulk queue operations</li>
                <li>• Queue analytics and insights</li>
                <li>• Custom queue scheduling rules</li>
                <li>• Priority queue management</li>
              </ul>
              <Button size="sm" className="mt-3 bg-blue-600 hover:bg-blue-700">
                Upgrade to Premium
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}