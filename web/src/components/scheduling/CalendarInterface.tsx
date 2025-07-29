// CalendarInterface.tsx - Interactive calendar with drag-and-drop scheduling
// Uses FullCalendar.js for professional calendar functionality with LinkedIn compliance

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Eye,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Zap,
  Target
} from 'lucide-react';

// Calendar event types
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
  linkedinProfileId?: string;
}

interface ConflictInfo {
  id: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
  affectedEvents: string[];
  suggestions: string[];
}

interface OptimalTimeSlot {
  datetime: Date;
  score: number;
  confidence: number;
  reasoning: string;
}

interface CalendarInterfaceProps {
  events: ScheduledEvent[];
  onEventDrop: (eventId: string, newDate: Date) => void;
  onDateSelect: (date: Date) => void;
  view: 'month' | 'week' | 'day';
  conflicts: ConflictInfo[];
  selectedDate: Date;
  onViewChange?: (view: 'month' | 'week' | 'day') => void;
}

export const CalendarInterface: React.FC<CalendarInterfaceProps> = ({
  events,
  onEventDrop,
  onDateSelect,
  view,
  conflicts,
  selectedDate,
  onViewChange
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [draggedEvent, setDraggedEvent] = useState<string | null>(null);
  const [optimalSlots, setOptimalSlots] = useState<OptimalTimeSlot[]>([]);
  const [showOptimalTimes, setShowOptimalTimes] = useState(true);
  const calendarRef = useRef<HTMLDivElement>(null);

  // Load optimal time slots for current view
  useEffect(() => {
    loadOptimalTimeSlots();
  }, [currentDate, view]);

  const loadOptimalTimeSlots = async () => {
    try {
      const response = await fetch('/api/v1/schedule/optimal-times', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          startDate: getViewStartDate().toISOString(),
          endDate: getViewEndDate().toISOString(),
          contentTypes: ['POST', 'ARTICLE', 'CAROUSEL', 'POLL']
        })
      });

      if (response.ok) {
        const data = await response.json();
        setOptimalSlots(data.recommendations || mockOptimalSlots);
      }
    } catch (err) {
      console.warn('Failed to load optimal time slots:', err);
      setOptimalSlots(mockOptimalSlots);
    }
  };

  const getViewStartDate = () => {
    const start = new Date(currentDate);
    if (view === 'month') {
      start.setDate(1);
    } else if (view === 'week') {
      const dayOfWeek = start.getDay();
      start.setDate(start.getDate() - dayOfWeek);
    }
    return start;
  };

  const getViewEndDate = () => {
    const end = new Date(currentDate);
    if (view === 'month') {
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
    } else if (view === 'week') {
      const dayOfWeek = end.getDay();
      end.setDate(end.getDate() + (6 - dayOfWeek));
    }
    return end;
  };

  const navigateCalendar = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    
    if (view === 'month') {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    } else if (view === 'week') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    } else {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    }
    
    setCurrentDate(newDate);
  };

  const handleEventDragStart = (eventId: string) => {
    setDraggedEvent(eventId);
  };

  const handleDateDrop = (date: Date, time?: number) => {
    if (!draggedEvent) return;

    const dropDateTime = new Date(date);
    if (time !== undefined) {
      dropDateTime.setHours(time, 0, 0, 0);
    }

    // Check for conflicts before allowing drop
    const conflicts = checkSchedulingConflicts(draggedEvent, dropDateTime);
    if (conflicts.length > 0) {
      alert(`Scheduling conflict detected: ${conflicts[0].message}`);
      return;
    }

    onEventDrop(draggedEvent, dropDateTime);
    setDraggedEvent(null);
  };

  const checkSchedulingConflicts = (eventId: string, newTime: Date): ConflictInfo[] => {
    const conflicts: ConflictInfo[] = [];
    const eventToMove = events.find(e => e.id === eventId);
    
    if (!eventToMove) return conflicts;

    // Check for events too close together (LinkedIn compliance)
    const minGap = 45 * 60 * 1000; // 45 minutes minimum gap
    const nearbyEvents = events.filter(e => 
      e.id !== eventId && 
      Math.abs(e.scheduledAt.getTime() - newTime.getTime()) < minGap
    );

    if (nearbyEvents.length > 0) {
      conflicts.push({
        id: `conflict-${Date.now()}`,
        message: 'Events must be at least 45 minutes apart for LinkedIn compliance',
        severity: 'high',
        affectedEvents: [eventId, ...nearbyEvents.map(e => e.id)],
        suggestions: ['Choose a time slot with more spacing between posts']
      });
    }

    // Check daily posting limits
    const sameDay = events.filter(e => 
      e.scheduledAt.toDateString() === newTime.toDateString() &&
      e.status !== 'CANCELLED'
    );

    if (sameDay.length >= 3) { // Max 3 posts per day
      conflicts.push({
        id: `daily-limit-${Date.now()}`,
        message: 'Maximum 3 posts per day for optimal engagement',
        severity: 'medium',
        affectedEvents: [eventId],
        suggestions: ['Schedule for a different day', 'Cancel an existing post for this day']
      });
    }

    return conflicts;
  };

  const getEventStatusColor = (status: string) => {
    switch (status) {
      case 'QUEUED': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'PROCESSING': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'PUBLISHED': return 'bg-green-100 text-green-800 border-green-200';
      case 'FAILED': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case 'ARTICLE': return '📝';
      case 'CAROUSEL': return '🎠';
      case 'POLL': return '📊';
      default: return '📄';
    }
  };

  const formatDateHeader = () => {
    const options: Intl.DateTimeFormatOptions = 
      view === 'month' 
        ? { year: 'numeric', month: 'long' }
        : view === 'week'
        ? { month: 'short', day: 'numeric', year: 'numeric' }
        : { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
    
    return currentDate.toLocaleDateString('en-US', options);
  };

  const renderMonthView = () => {
    const startDate = getViewStartDate();
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const firstDayOfWeek = startDate.getDay();
    
    const days = [];
    const today = new Date();

    // Previous month's trailing days
    for (let i = 0; i < firstDayOfWeek; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() - (firstDayOfWeek - i));
      days.push({ date, isCurrentMonth: false });
    }

    // Current month's days
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), i);
      days.push({ date, isCurrentMonth: true });
    }

    // Next month's leading days
    const totalCells = 42; // 6 rows × 7 days
    const remaining = totalCells - days.length;
    for (let i = 1; i <= remaining; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, i);
      days.push({ date, isCurrentMonth: false });
    }

    return (
      <div className="grid grid-cols-7 gap-1">
        {/* Day headers */}
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="p-2 text-center font-medium text-gray-500 text-sm">
            {day}
          </div>
        ))}
        
        {/* Calendar days */}
        {days.map((day, index) => {
          const dayEvents = events.filter(event => 
            event.scheduledAt.toDateString() === day.date.toDateString()
          );
          
          const optimalSlotsForDay = optimalSlots.filter(slot =>
            slot.datetime.toDateString() === day.date.toDateString()
          );

          const isToday = day.date.toDateString() === today.toDateString();
          const isSelected = day.date.toDateString() === selectedDate.toDateString();

          return (
            <div
              key={index}
              className={`
                min-h-[120px] p-1 border border-gray-200 cursor-pointer
                ${day.isCurrentMonth ? 'bg-white' : 'bg-gray-50'}
                ${isToday ? 'bg-blue-50 border-blue-300' : ''}
                ${isSelected ? 'ring-2 ring-blue-500' : ''}
                hover:bg-gray-50 transition-colors
              `}
              onClick={() => onDateSelect(day.date)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDateDrop(day.date)}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`
                  text-sm font-medium
                  ${day.isCurrentMonth ? 'text-gray-900' : 'text-gray-400'}
                  ${isToday ? 'text-blue-600 font-bold' : ''}
                `}>
                  {day.date.getDate()}
                </span>
                
                {showOptimalTimes && optimalSlotsForDay.length > 0 && (
                  <Zap className="h-3 w-3 text-yellow-500" title="Optimal posting time" />
                )}
              </div>

              {/* Events for this day */}
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map(event => (
                  <div
                    key={event.id}
                    className={`
                      p-1 rounded text-xs border cursor-move
                      ${getEventStatusColor(event.status)}
                    `}
                    draggable
                    onDragStart={() => handleEventDragStart(event.id)}
                    title={`${event.title} (${event.status})`}
                  >
                    <div className="flex items-center gap-1">
                      <span>{getContentTypeIcon(event.contentType)}</span>
                      <span className="truncate flex-1">{event.title}</span>
                      {event.optimalTimeScore && event.optimalTimeScore > 0.8 && (
                        <Target className="h-3 w-3" />
                      )}
                    </div>
                  </div>
                ))}
                
                {dayEvents.length > 3 && (
                  <div className="text-xs text-gray-500 px-1">
                    +{dayEvents.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderWeekView = () => {
    const startDate = getViewStartDate();
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      return date;
    });

    const hours = Array.from({ length: 24 }, (_, i) => i);

    return (
      <div className="grid grid-cols-8 gap-1">
        {/* Time column header */}
        <div className="p-2 border-b border-gray-200"></div>
        
        {/* Day headers */}
        {days.map(day => (
          <div
            key={day.toISOString()}
            className="p-2 text-center border-b border-gray-200 cursor-pointer hover:bg-gray-50"
            onClick={() => onDateSelect(day)}
          >
            <div className="font-medium">{day.toLocaleDateString('en-US', { weekday: 'short' })}</div>
            <div className="text-sm text-gray-500">{day.getDate()}</div>
          </div>
        ))}

        {/* Time slots */}
        {hours.map(hour => (
          <React.Fragment key={hour}>
            {/* Time label */}
            <div className="p-2 text-xs text-gray-500 border-r border-gray-200">
              {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
            </div>
            
            {/* Day columns */}
            {days.map(day => {
              const slotDateTime = new Date(day);
              slotDateTime.setHours(hour, 0, 0, 0);
              
              const slotEvents = events.filter(event => {
                const eventHour = event.scheduledAt.getHours();
                return event.scheduledAt.toDateString() === day.toDateString() && eventHour === hour;
              });

              const isOptimalTime = optimalSlots.some(slot => 
                slot.datetime.toDateString() === day.toDateString() && 
                slot.datetime.getHours() === hour
              );

              return (
                <div
                  key={`${day.toISOString()}-${hour}`}
                  className={`
                    min-h-[60px] p-1 border border-gray-100 cursor-pointer
                    ${isOptimalTime ? 'bg-yellow-50' : 'bg-white'}
                    hover:bg-gray-50 transition-colors
                  `}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDateDrop(day, hour)}
                >
                  {isOptimalTime && showOptimalTimes && (
                    <Zap className="h-3 w-3 text-yellow-500 mb-1" />
                  )}
                  
                  {slotEvents.map(event => (
                    <div
                      key={event.id}
                      className={`
                        p-1 rounded text-xs border mb-1 cursor-move
                        ${getEventStatusColor(event.status)}
                      `}
                      draggable
                      onDragStart={() => handleEventDragStart(event.id)}
                    >
                      <div className="flex items-center gap-1">
                        <span>{getContentTypeIcon(event.contentType)}</span>
                        <span className="truncate">{event.title}</span>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    );
  };

  const renderDayView = () => {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const dayEvents = events.filter(event => 
      event.scheduledAt.toDateString() === currentDate.toDateString()
    );

    return (
      <div className="space-y-1">
        {hours.map(hour => {
          const slotDateTime = new Date(currentDate);
          slotDateTime.setHours(hour, 0, 0, 0);
          
          const hourEvents = dayEvents.filter(event => event.scheduledAt.getHours() === hour);
          
          const isOptimalTime = optimalSlots.some(slot => 
            slot.datetime.toDateString() === currentDate.toDateString() && 
            slot.datetime.getHours() === hour
          );

          return (
            <div
              key={hour}
              className={`
                min-h-[80px] p-3 border border-gray-200 rounded-lg cursor-pointer
                ${isOptimalTime ? 'bg-yellow-50 border-yellow-200' : 'bg-white'}
                hover:bg-gray-50 transition-colors
              `}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDateDrop(currentDate, hour)}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-700">
                  {hour === 0 ? '12:00 AM' : hour < 12 ? `${hour}:00 AM` : hour === 12 ? '12:00 PM' : `${hour - 12}:00 PM`}
                </span>
                
                {isOptimalTime && showOptimalTimes && (
                  <Badge variant="outline" className="gap-1">
                    <Zap className="h-3 w-3" />
                    Optimal Time
                  </Badge>
                )}
              </div>

              <div className="space-y-2">
                {hourEvents.map(event => (
                  <div
                    key={event.id}
                    className={`
                      p-2 rounded border cursor-move
                      ${getEventStatusColor(event.status)}
                    `}
                    draggable
                    onDragStart={() => handleEventDragStart(event.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span>{getContentTypeIcon(event.contentType)}</span>
                        <span className="font-medium">{event.title}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {event.engagementPrediction && (
                          <Badge variant="outline" className="text-xs">
                            {Math.round(event.engagementPrediction * 100)}% engagement
                          </Badge>
                        )}
                        {event.optimalTimeScore && event.optimalTimeScore > 0.8 && (
                          <Target className="h-4 w-4 text-green-500" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Content Calendar
          </CardTitle>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowOptimalTimes(!showOptimalTimes)}
              className="gap-1"
            >
              <Zap className="h-3 w-3" />
              {showOptimalTimes ? 'Hide' : 'Show'} Optimal Times
            </Button>
            
            <div className="flex items-center gap-1 border rounded-md">
              <Button
                variant={view === 'month' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onViewChange?.('month')}
              >
                Month
              </Button>
              <Button
                variant={view === 'week' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onViewChange?.('week')}
              >
                Week
              </Button>
              <Button
                variant={view === 'day' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onViewChange?.('day')}
              >
                Day
              </Button>
            </div>
          </div>
        </div>
        
        {/* Calendar Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateCalendar('prev')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <h3 className="text-lg font-semibold min-w-[200px] text-center">
              {formatDateHeader()}
            </h3>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateCalendar('next')}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentDate(new Date())}
          >
            Today
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Conflicts Alert */}
        {conflicts.length > 0 && (
          <Alert className="mb-4" variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {conflicts.length} scheduling conflict(s) detected. 
              <Button variant="link" className="p-0 h-auto ml-1">
                View details
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Calendar Views */}
        <div ref={calendarRef} className="overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <>
              {view === 'month' && renderMonthView()}
              {view === 'week' && renderWeekView()}
              {view === 'day' && renderDayView()}
            </>
          )}
        </div>
        
        {/* Legend */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-100 border border-blue-200 rounded"></div>
                <span>Queued</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-yellow-100 border border-yellow-200 rounded"></div>
                <span>Processing</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-100 border border-green-200 rounded"></div>
                <span>Published</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="h-3 w-3 text-yellow-500" />
                <span>Optimal Time</span>
              </div>
            </div>
            
            <span className="text-gray-500">
              Drag events to reschedule • Click dates to schedule new content
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Mock optimal time slots for development
const mockOptimalSlots: OptimalTimeSlot[] = [
  {
    datetime: new Date(Date.now() + 9 * 60 * 60 * 1000), // 9 AM today
    score: 0.92,
    confidence: 0.87,
    reasoning: 'High engagement based on historical data'
  },
  {
    datetime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000), // 2 PM tomorrow
    score: 0.88,
    confidence: 0.82,
    reasoning: 'Peak professional browsing time'
  }
];

export default CalendarInterface;