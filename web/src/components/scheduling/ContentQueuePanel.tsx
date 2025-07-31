// ContentQueuePanel.tsx - Manage unscheduled content items with drag-and-drop scheduling
// Displays draft content items ready for scheduling with priority management

'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Clock,
  Search,
  Calendar,
  TrendingUp,
  Eye,
  Edit,
  Trash2,
  Image,
  FileText,
  BarChart3,
  MessageSquare,
  Star,
  ArrowUp,
  ArrowDown,
  Plus,
  Zap
} from 'lucide-react';

interface ContentQueueItem {
  id: string;
  title: string;
  contentType: 'POST' | 'ARTICLE' | 'CAROUSEL' | 'POLL';
  content: string;
  priority: number;
  createdAt: Date;
  estimatedEngagement?: number;
  isDraft: boolean;
  bannerId?: string;
  tags?: string[];
  wordCount?: number;
  schedulingScore?: number;
}

interface ContentQueuePanelProps {
  queueItems: ContentQueueItem[];
  onScheduleItem: (item: ContentQueueItem, timing: Date) => void;
  onRefresh: () => void;
  onEditItem?: (itemId: string) => void;
  onDeleteItem?: (itemId: string) => void;
  onUpdatePriority?: (itemId: string, newPriority: number) => void;
}

export const ContentQueuePanel: React.FC<ContentQueuePanelProps> = ({
  queueItems,
  onScheduleItem,
  onRefresh,
  onEditItem,
  onDeleteItem,
  onUpdatePriority
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'priority' | 'created' | 'engagement'>('priority');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ContentQueueItem | null>(null);

  // Filter and sort queue items
  const filteredItems = queueItems
    .filter(item => {
      const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           item.content.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = selectedType === 'all' || item.contentType === selectedType;
      return matchesSearch && matchesType;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'priority':
          return b.priority - a.priority;
        case 'created':
          return b.createdAt.getTime() - a.createdAt.getTime();
        case 'engagement':
          return (b.estimatedEngagement || 0) - (a.estimatedEngagement || 0);
        default:
          return 0;
      }
    });

  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case 'ARTICLE': return <FileText className="h-4 w-4" />;
      case 'CAROUSEL': return <Image className="h-4 w-4" />;
      case 'POLL': return <BarChart3 className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: number) => {
    if (priority >= 8) return 'text-red-500';
    if (priority >= 6) return 'text-orange-500';
    if (priority >= 4) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getPriorityLabel = (priority: number) => {
    if (priority >= 8) return 'High';
    if (priority >= 6) return 'Medium';
    if (priority >= 4) return 'Normal';
    return 'Low';
  };

  const handleScheduleNow = (item: ContentQueueItem) => {
    // Schedule for optimal time in next 2 hours
    const optimalTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
    onScheduleItem(item, optimalTime);
  };

  const handleScheduleCustom = (item: ContentQueueItem) => {
    setSelectedItem(item);
    setShowScheduleModal(true);
  };

  const handlePriorityChange = (item: ContentQueueItem, delta: number) => {
    const newPriority = Math.max(1, Math.min(10, item.priority + delta));
    onUpdatePriority?.(item.id, newPriority);
  };

  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const getEngagementBadge = (engagement?: number) => {
    if (!engagement) return null;
    
    const score = Math.round(engagement * 100);
    let variant: "default" | "secondary" | "destructive" | "outline" = "outline";
    
    if (score >= 80) variant = "default";
    else if (score >= 60) variant = "secondary";
    
    return (
      <Badge variant={variant} className="gap-1">
        <TrendingUp className="h-3 w-3" />
        {score}%
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Clock className="h-6 w-6" />
            Content Queue
          </h2>
          <p className="text-gray-600">
            {queueItems.length} items ready for scheduling
          </p>
        </div>
        
        <Button onClick={onRefresh} variant="outline" className="gap-2">
          <Plus className="h-4 w-4" />
          Add Content
        </Button>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Content Type Filter */}
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger>
                <SelectValue placeholder="Content type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="POST">Posts</SelectItem>
                <SelectItem value="ARTICLE">Articles</SelectItem>
                <SelectItem value="CAROUSEL">Carousels</SelectItem>
                <SelectItem value="POLL">Polls</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort By */}
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as 'priority' | 'created' | 'engagement')}>
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="priority">Priority</SelectItem>
                <SelectItem value="created">Created Date</SelectItem>
                <SelectItem value="engagement">Engagement Score</SelectItem>
              </SelectContent>
            </Select>

            {/* Bulk Actions */}
            {selectedItems.length > 0 && (
              <Button variant="outline" className="gap-2">
                <Calendar className="h-4 w-4" />
                Schedule {selectedItems.length} Items
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Queue Items */}
      <div className="space-y-4">
        {filteredItems.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Clock className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No content in queue</h3>
              <p className="text-gray-600 mb-4">
                Create content to see it in your scheduling queue
              </p>
              <Button onClick={onRefresh}>
                <Plus className="h-4 w-4 mr-2" />
                Create Content
              </Button>
            </CardContent>
          </Card>
        ) : (
          filteredItems.map(item => (
            <Card key={item.id} className="group hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Selection Checkbox */}
                  <input
                    type="checkbox"
                    checked={selectedItems.includes(item.id)}
                    onChange={() => toggleItemSelection(item.id)}
                    className="mt-1"
                  />

                  {/* Content Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 flex-1">
                        {getContentTypeIcon(item.contentType)}
                        <h3 className="font-semibold truncate">{item.title}</h3>
                        {item.bannerId && (
                          <Badge variant="outline" className="gap-1">
                            <Image className="h-3 w-3" />
                            Banner
                          </Badge>
                        )}
                      </div>
                      
                      {/* Priority Controls */}
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePriorityChange(item, 1)}
                          className="p-1 h-6 w-6"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Badge 
                          variant="outline" 
                          className={`${getPriorityColor(item.priority)} border-current`}
                        >
                          {getPriorityLabel(item.priority)}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePriorityChange(item, -1)}
                          className="p-1 h-6 w-6"
                        >
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Content Preview */}
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {item.content}
                    </p>

                    {/* Metadata */}
                    <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                      <span>Created {item.createdAt.toLocaleDateString()}</span>
                      {item.wordCount && (
                        <span>{item.wordCount} words</span>
                      )}
                      <span className="flex items-center gap-1">
                        <Badge variant="outline">{item.contentType}</Badge>
                      </span>
                    </div>

                    {/* Metrics and Tags */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getEngagementBadge(item.estimatedEngagement)}
                        
                        {item.schedulingScore && (
                          <Badge variant="outline" className="gap-1">
                            <Zap className="h-3 w-3" />
                            {Math.round(item.schedulingScore * 100)}% optimal
                          </Badge>
                        )}
                      </div>

                      {/* Tags */}
                      {item.tags && item.tags.length > 0 && (
                        <div className="flex items-center gap-1">
                          {item.tags.slice(0, 2).map(tag => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {item.tags.length > 2 && (
                            <span className="text-xs text-gray-500">
                              +{item.tags.length - 2} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="sm"
                      onClick={() => handleScheduleNow(item)}
                      className="gap-1"
                    >
                      <Zap className="h-3 w-3" />
                      Schedule Now
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleScheduleCustom(item)}
                      className="gap-1"
                    >
                      <Calendar className="h-3 w-3" />
                      Custom Time
                    </Button>
                    
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onEditItem?.(item.id)}
                        className="p-1 h-6 w-6"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onDeleteItem?.(item.id)}
                        className="p-1 h-6 w-6 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Queue Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Queue Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {queueItems.length}
              </div>
              <div className="text-sm text-gray-600">Total Items</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {queueItems.filter(item => item.priority >= 6).length}
              </div>
              <div className="text-sm text-gray-600">High Priority</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {Math.round(
                  queueItems.reduce((sum, item) => sum + (item.estimatedEngagement || 0), 0) / 
                  queueItems.length * 100
                ) || 0}%
              </div>
              <div className="text-sm text-gray-600">Avg. Engagement</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {queueItems.filter(item => item.bannerId).length}
              </div>
              <div className="text-sm text-gray-600">With Banners</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Custom Scheduling Modal would go here */}
      {showScheduleModal && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Schedule Content</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Custom scheduling modal for: {selectedItem.title}</p>
              <div className="flex gap-2 mt-4">
                <Button onClick={() => setShowScheduleModal(false)} variant="outline">
                  Cancel
                </Button>
                <Button onClick={() => {
                  handleScheduleNow(selectedItem);
                  setShowScheduleModal(false);
                }}>
                  Schedule
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ContentQueuePanel;