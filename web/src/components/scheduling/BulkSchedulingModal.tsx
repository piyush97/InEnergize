// BulkSchedulingModal.tsx - Modal for bulk content scheduling with templates
// Supports CSV import, template-based scheduling, and intelligent timing distribution

'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Calendar,
  Clock,
  Upload,
  Download,
  Zap,
  Settings,
  CheckCircle2,
  AlertCircle,
  X,
  Plus,
  Trash2,
  Play,
  FileText,
  Target,
  Users,
  BarChart3,
  Eye
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
}

interface ScheduledEvent {
  id: string;
  contentId: string;
  title: string;
  contentType: 'POST' | 'ARTICLE' | 'CAROUSEL' | 'POLL';
  scheduledAt: Date;
  status: 'QUEUED' | 'PROCESSING' | 'PUBLISHED' | 'FAILED' | 'CANCELLED';
  priority: number;
  engagementPrediction?: number;
  optimalTimeScore?: number;
}

interface SchedulingTemplate {
  id: string;
  name: string;
  description: string;
  pattern: 'daily' | 'weekly' | 'custom';
  timeSlots: string[];
  daysOfWeek: number[];
  spacing: number; // hours between posts
  startDate: Date;
  endDate?: Date;
}

interface BulkSchedulingModalProps {
  isOpen: boolean;
  onClose: () => void;
  queueItems: ContentQueueItem[];
  onBulkSchedule: (events: ScheduledEvent[]) => void;
  templates?: SchedulingTemplate[];
}

export const BulkSchedulingModal: React.FC<BulkSchedulingModalProps> = ({
  isOpen,
  onClose,
  queueItems,
  onBulkSchedule,
  templates = mockTemplates
}) => {
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [schedulingMethod, setSchedulingMethod] = useState<'template' | 'custom' | 'optimal'>('optimal');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [customSettings, setCustomSettings] = useState({
    startDate: new Date(),
    interval: 'daily' as 'daily' | 'weekly' | 'custom',
    spacing: 2, // hours
    timeSlots: ['09:00', '14:00'],
    daysOfWeek: [1, 2, 3, 4, 5], // Monday to Friday
    useOptimalTiming: true
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewEvents, setPreviewEvents] = useState<ScheduledEvent[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  // CSV import state
  const [csvData, setCsvData] = useState<string>('');
  const [showCsvImport, setShowCsvImport] = useState(false);

  const handleItemSelection = (itemId: string) => {
    setSelectedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const selectAllItems = () => {
    setSelectedItems(queueItems.map(item => item.id));
  };

  const clearSelection = () => {
    setSelectedItems([]);
  };

  const generatePreview = async () => {
    if (selectedItems.length === 0) {
      setError('Please select at least one content item');
      return;
    }

    setError(null);
    const items = queueItems.filter(item => selectedItems.includes(item.id));
    
    try {
      let schedules: Date[] = [];
      
      if (schedulingMethod === 'template' && selectedTemplate) {
        const template = templates.find(t => t.id === selectedTemplate);
        if (template) {
          schedules = generateTemplateSchedules(template, items.length);
        }
      } else if (schedulingMethod === 'optimal') {
        schedules = await generateOptimalSchedules(items.length);
      } else {
        schedules = generateCustomSchedules(items.length);
      }

      const events: ScheduledEvent[] = items.map((item, index) => ({
        id: `bulk-${Date.now()}-${index}`,
        contentId: item.id,
        title: item.title,
        contentType: item.contentType,
        scheduledAt: schedules[index] || new Date(),
        status: 'QUEUED' as const,
        priority: item.priority,
        engagementPrediction: item.estimatedEngagement,
        optimalTimeScore: Math.random() * 0.3 + 0.7 // Mock optimal score
      }));

      setPreviewEvents(events);
      setShowPreview(true);

    } catch (err) {
      setError('Failed to generate scheduling preview');
    }
  };

  const generateTemplateSchedules = (template: SchedulingTemplate, count: number): Date[] => {
    const schedules: Date[] = [];
    const currentDate = new Date(template.startDate);
    
    for (let i = 0; i < count; i++) {
      // Find next valid day and time slot
      while (schedules.length <= i) {
        if (template.daysOfWeek.includes(currentDate.getDay())) {
          for (const timeSlot of template.timeSlots) {
            if (schedules.length >= count) break;
            
            const [hours, minutes] = timeSlot.split(':').map(Number);
            const scheduleDate = new Date(currentDate);
            scheduleDate.setHours(hours, minutes, 0, 0);
            
            if (scheduleDate > new Date()) {
              schedules.push(scheduleDate);
            }
          }
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }
    
    return schedules;
  };

  const generateOptimalSchedules = async (count: number): Promise<Date[]> => {
    // Simulate API call for optimal times
    const schedules: Date[] = [];
    const baseDate = new Date();
    
    // Mock optimal times - typically Tuesday/Thursday 9 AM, 2 PM
    const optimalSlots = [
      { day: 2, hour: 9 },   // Tuesday 9 AM
      { day: 2, hour: 14 },  // Tuesday 2 PM
      { day: 4, hour: 9 },   // Thursday 9 AM
      { day: 4, hour: 14 },  // Thursday 2 PM
      { day: 1, hour: 11 },  // Monday 11 AM
      { day: 3, hour: 13 },  // Wednesday 1 PM
    ];
    
    for (let i = 0; i < count; i++) {
      const slotIndex = i % optimalSlots.length;
      const slot = optimalSlots[slotIndex];
      const weekOffset = Math.floor(i / optimalSlots.length);
      
      const scheduleDate = new Date(baseDate);
      scheduleDate.setDate(baseDate.getDate() + (slot.day - baseDate.getDay()) + (weekOffset * 7));
      scheduleDate.setHours(slot.hour, 0, 0, 0);
      
      if (scheduleDate <= baseDate) {
        scheduleDate.setDate(scheduleDate.getDate() + 7);
      }
      
      schedules.push(scheduleDate);
    }
    
    return schedules.sort((a, b) => a.getTime() - b.getTime());
  };

  const generateCustomSchedules = (count: number): Date[] => {
    const schedules: Date[] = [];
    const currentDate = new Date(customSettings.startDate);
    
    for (let i = 0; i < count; i++) {
      // Find next valid day
      while (!customSettings.daysOfWeek.includes(currentDate.getDay())) {
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      // Use time slots
      const timeSlot = customSettings.timeSlots[i % customSettings.timeSlots.length];
      const [hours, minutes] = timeSlot.split(':').map(Number);
      
      const scheduleDate = new Date(currentDate);
      scheduleDate.setHours(hours, minutes, 0, 0);
      schedules.push(scheduleDate);
      
      // Move to next scheduling window
      if (customSettings.interval === 'daily') {
        currentDate.setDate(currentDate.getDate() + 1);
      } else if (customSettings.interval === 'weekly') {
        currentDate.setDate(currentDate.getDate() + 7);
      } else {
        currentDate.setTime(currentDate.getTime() + customSettings.spacing * 60 * 60 * 1000);
      }
    }
    
    return schedules;
  };

  const executeBulkScheduling = async () => {
    if (previewEvents.length === 0) {
      await generatePreview();
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setError(null);

    try {
      // Simulate API calls with progress updates
      for (let i = 0; i < previewEvents.length; i++) {
        const event = previewEvents[i];
        
        const response = await fetch('/api/v1/schedule/content', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          },
          body: JSON.stringify({
            contentId: event.contentId,
            scheduledAt: event.scheduledAt.toISOString(),
            priority: event.priority,
            useOptimalTiming: customSettings.useOptimalTiming
          })
        });

        if (!response.ok) {
          throw new Error(`Failed to schedule ${event.title}`);
        }

        setProgress(((i + 1) / previewEvents.length) * 100);
        
        // Add delay for rate limiting
        if (i < previewEvents.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      onBulkSchedule(previewEvents);
      onClose();

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule content');
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const handleCsvImport = () => {
    // Parse CSV data and convert to content items
    const lines = csvData.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      setError('CSV must have at least a header row and one data row');
      return;
    }

    try {
      // Parse CSV (simplified - in real app, use a proper CSV parser)
      const headers = lines[0].split(',').map(h => h.trim());
      const data = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const obj: Record<string, string> = {};
        headers.forEach((header, index) => {
          obj[header] = values[index];
        });
        return obj;
      });

      // Convert to scheduling format
      const importedSchedules = data.map((row, index) => ({
        id: `csv-import-${index}`,
        contentId: row.contentId || `generated-${index}`,
        title: row.title || `Imported Content ${index + 1}`,
        contentType: (row.contentType || 'POST') as 'POST' | 'ARTICLE' | 'CAROUSEL' | 'POLL',
        scheduledAt: new Date(row.scheduledAt || Date.now()),
        status: 'QUEUED' as const,
        priority: parseInt(row.priority) || 5,
        engagementPrediction: parseFloat(row.engagementPrediction) || undefined
      }));

      setPreviewEvents(importedSchedules);
      setShowPreview(true);
      setShowCsvImport(false);

    } catch (err) {
      setError('Failed to parse CSV data. Please check the format.');
    }
  };

  const exportTemplate = () => {
    const csv = [
      'contentId,title,contentType,scheduledAt,priority,engagementPrediction',
      'example-1,"Sample Post","POST","2024-01-15T09:00:00Z",5,0.75',
      'example-2,"Sample Article","ARTICLE","2024-01-16T14:00:00Z",7,0.82'
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bulk-scheduling-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Bulk Content Scheduling
          </DialogTitle>
          <DialogDescription>
            Schedule multiple content items efficiently with AI-powered timing optimization
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Processing Progress */}
        {isProcessing && (
          <Card>
            <CardContent className="p-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Scheduling content...</span>
                  <span className="text-sm text-gray-500">{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} />
              </div>
            </CardContent>
          </Card>
        )}

        {!showPreview ? (
          <div className="space-y-6">
            {/* Content Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  Select Content Items
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={selectAllItems}>
                      Select All
                    </Button>
                    <Button variant="outline" size="sm" onClick={clearSelection}>
                      Clear
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-48 overflow-y-auto">
                {queueItems.map(item => (
                  <div
                    key={item.id}
                    className={`
                      p-3 border rounded cursor-pointer transition-colors
                      ${selectedItems.includes(item.id) 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:bg-gray-50'}
                    `}
                    onClick={() => handleItemSelection(item.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedItems.includes(item.id)}
                          onChange={() => {}}
                        />
                        <span className="font-medium">{item.title}</span>
                        <Badge variant="outline">{item.contentType}</Badge>
                      </div>
                      
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span>Priority: {item.priority}</span>
                        {item.estimatedEngagement && (
                          <Badge variant="secondary">
                            {Math.round(item.estimatedEngagement * 100)}% engagement
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Scheduling Method */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Scheduling Method</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div
                    className={`
                      p-4 border rounded-lg cursor-pointer transition-colors
                      ${schedulingMethod === 'optimal' 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:bg-gray-50'}
                    `}
                    onClick={() => setSchedulingMethod('optimal')}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="h-5 w-5 text-yellow-500" />
                      <span className="font-medium">AI Optimal</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Let AI choose the best times based on engagement patterns
                    </p>
                  </div>

                  <div
                    className={`
                      p-4 border rounded-lg cursor-pointer transition-colors
                      ${schedulingMethod === 'template' 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:bg-gray-50'}
                    `}
                    onClick={() => setSchedulingMethod('template')}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-5 w-5 text-blue-500" />
                      <span className="font-medium">Template</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Use pre-configured scheduling templates
                    </p>
                  </div>

                  <div
                    className={`
                      p-4 border rounded-lg cursor-pointer transition-colors
                      ${schedulingMethod === 'custom' 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:bg-gray-50'}
                    `}
                    onClick={() => setSchedulingMethod('custom')}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Settings className="h-5 w-5 text-gray-500" />
                      <span className="font-medium">Custom</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Configure your own scheduling pattern
                    </p>
                  </div>
                </div>

                {/* Template Selection */}
                {schedulingMethod === 'template' && (
                  <div className="space-y-2">
                    <Label>Select Template</Label>
                    <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a scheduling template" />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map(template => (
                          <SelectItem key={template.id} value={template.id}>
                            <div>
                              <div className="font-medium">{template.name}</div>
                              <div className="text-xs text-gray-500">{template.description}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Custom Settings */}
                {schedulingMethod === 'custom' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Start Date</Label>
                      <Input
                        type="date"
                        value={customSettings.startDate.toISOString().split('T')[0]}
                        onChange={(e) => setCustomSettings(prev => ({
                          ...prev,
                          startDate: new Date(e.target.value)
                        }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Interval</Label>
                      <Select 
                        value={customSettings.interval} 
                        onValueChange={(value) => setCustomSettings(prev => ({
                          ...prev,
                          interval: value as 'daily' | 'weekly' | 'custom'
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="custom">Custom Hours</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Time Slots</Label>
                      <div className="flex gap-2">
                        {customSettings.timeSlots.map((slot, index) => (
                          <Input
                            key={index}
                            type="time"
                            value={slot}
                            onChange={(e) => {
                              const newSlots = [...customSettings.timeSlots];
                              newSlots[index] = e.target.value;
                              setCustomSettings(prev => ({ ...prev, timeSlots: newSlots }));
                            }}
                            className="w-32"
                          />
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCustomSettings(prev => ({
                            ...prev,
                            timeSlots: [...prev.timeSlots, '12:00']
                          }))}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Days of Week</Label>
                      <div className="flex gap-2">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                          <Button
                            key={day}
                            variant={customSettings.daysOfWeek.includes(index) ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                              const newDays = customSettings.daysOfWeek.includes(index)
                                ? customSettings.daysOfWeek.filter(d => d !== index)
                                : [...customSettings.daysOfWeek, index];
                              setCustomSettings(prev => ({ ...prev, daysOfWeek: newDays }));
                            }}
                          >
                            {day}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* CSV Import Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  Advanced Options
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={exportTemplate}>
                      <Download className="h-3 w-3 mr-1" />
                      Export Template
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setShowCsvImport(!showCsvImport)}>
                      <Upload className="h-3 w-3 mr-1" />
                      CSV Import
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              {showCsvImport && (
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>CSV Data</Label>
                    <Textarea
                      placeholder="contentId,title,contentType,scheduledAt,priority,engagementPrediction"
                      value={csvData}
                      onChange={(e) => setCsvData(e.target.value)}
                      rows={8}
                    />
                  </div>
                  <Button onClick={handleCsvImport}>
                    Import Schedule
                  </Button>
                </CardContent>
              )}
            </Card>

            {/* Action Buttons */}
            <div className="flex justify-between">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={generatePreview} disabled={selectedItems.length === 0}>
                Preview Schedule
              </Button>
            </div>
          </div>
        ) : (
          /* Preview Section */
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Eye className="h-5 w-5" />
                    Schedule Preview
                  </span>
                  <Button variant="outline" onClick={() => setShowPreview(false)}>
                    <Settings className="h-4 w-4 mr-1" />
                    Modify
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {previewEvents.map((event, index) => (
                    <div key={event.id} className="flex items-center justify-between p-3 border rounded">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{index + 1}.</span>
                        <span className="font-medium">{event.title}</span>
                        <Badge variant="outline">{event.contentType}</Badge>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm">
                        <span>{event.scheduledAt.toLocaleDateString()}</span>
                        <span>{event.scheduledAt.toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}</span>
                        {event.optimalTimeScore && (
                          <Badge variant="secondary" className="gap-1">
                            <Target className="h-3 w-3" />
                            {Math.round(event.optimalTimeScore * 100)}%
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-lg font-bold">{previewEvents.length}</div>
                      <div className="text-sm text-gray-600">Items to Schedule</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold">
                        {Math.round(previewEvents.reduce((sum, event) => 
                          sum + (event.optimalTimeScore || 0), 0) / previewEvents.length * 100)}%
                      </div>
                      <div className="text-sm text-gray-600">Avg. Optimal Score</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold">
                        {Math.ceil((previewEvents[previewEvents.length - 1]?.scheduledAt.getTime() - 
                         previewEvents[0]?.scheduledAt.getTime()) / (1000 * 60 * 60 * 24))} days
                      </div>
                      <div className="text-sm text-gray-600">Schedule Duration</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Execute Buttons */}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setShowPreview(false)}>
                Back to Settings
              </Button>
              <Button 
                onClick={executeBulkScheduling} 
                disabled={isProcessing}
                className="gap-2"
              >
                <Play className="h-4 w-4" />
                {isProcessing ? 'Scheduling...' : `Schedule ${previewEvents.length} Items`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

// Mock templates for development
const mockTemplates: SchedulingTemplate[] = [
  {
    id: 'template-1',
    name: 'Professional Weekly',
    description: 'Tuesday & Thursday, 9 AM and 2 PM',
    pattern: 'weekly',
    timeSlots: ['09:00', '14:00'],
    daysOfWeek: [2, 4], // Tuesday, Thursday
    spacing: 2,
    startDate: new Date()
  },
  {
    id: 'template-2',
    name: 'Daily Lunch Hour',
    description: 'Every weekday at 12 PM',
    pattern: 'daily',
    timeSlots: ['12:00'],
    daysOfWeek: [1, 2, 3, 4, 5], // Monday to Friday
    spacing: 24,
    startDate: new Date()
  },
  {
    id: 'template-3',
    name: 'Intensive Launch',
    description: 'Daily posting with 4 hour gaps',
    pattern: 'custom',
    timeSlots: ['09:00', '13:00', '17:00'],
    daysOfWeek: [1, 2, 3, 4, 5, 6], // Monday to Saturday
    spacing: 4,
    startDate: new Date()
  }
];

export default BulkSchedulingModal;