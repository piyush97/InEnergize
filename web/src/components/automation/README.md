# LinkedIn Automation UI Components

Comprehensive automation UI components for the InErgize web application, designed for safe and compliant LinkedIn automation.

## Components Overview

### 1. AutomationDashboard
Main dashboard component that orchestrates all automation features.

**Features:**
- Real-time automation status and statistics
- WebSocket integration for live updates
- Tabbed interface for different automation types
- Subscription tier awareness
- Emergency stop functionality

```tsx
import { AutomationDashboard } from '@/components/automation';

<AutomationDashboard
  userId="user-123"
  subscriptionTier="premium"
  onSettingsOpen={() => setSettingsOpen(true)}
/>
```

### 2. ConnectionAutomation
Interface for managing LinkedIn connection request automation.

**Features:**
- Schedule connection requests with personalized messages
- Template integration
- Priority-based scheduling
- Target profile selection
- Progress tracking with daily limits
- Cancel pending requests

```tsx
import { ConnectionAutomation } from '@/components/automation';

<ConnectionAutomation
  userId="user-123"
  templates={connectionTemplates}
  stats={connectionStats}
  onScheduleConnection={handleScheduleConnection}
  onCancelConnection={handleCancelConnection}
/>
```

### 3. EngagementAutomation  
Comprehensive engagement automation for likes, comments, profile views, and follows.

**Features:**
- Multi-type engagement (like, comment, view, follow)
- Bulk operation mode
- Recent posts integration
- Profile suggestions
- Template-based comments
- Success rate tracking

```tsx
import { EngagementAutomation } from '@/components/automation';

<EngagementAutomation
  userId="user-123"
  templates={commentTemplates}
  stats={engagementStats}
  onScheduleEngagement={handleScheduleEngagement}
/>
```

### 4. SafetyMonitorWidget
Real-time safety monitoring with alert system and compliance tracking.

**Features:**
- Real-time safety score (0-100)
- Active alerts with severity levels
- LinkedIn compliance monitoring
- Emergency stop functionality
- Risk factor analysis
- Performance metrics tracking

```tsx
import { SafetyMonitorWidget } from '@/components/automation';

<SafetyMonitorWidget
  userId="user-123"
  status={safetyStatus}
  onEmergencyStop={handleEmergencyStop}
  onResumeAutomation={handleResumeAutomation}
  onAcknowledgeAlert={handleAcknowledgeAlert}
/>
```

### 5. AutomationQueuePanel
Visual queue management with drag-and-drop reordering.

**Features:**
- Drag-and-drop queue reordering
- Bulk operations (cancel multiple)
- Filtering and search
- Queue statistics and progress
- Retry failed items
- Estimated completion times

```tsx
import { AutomationQueuePanel } from '@/components/automation';

<AutomationQueuePanel
  userId="user-123"
  items={queueItems}
  onReorderItems={handleReorderItems}
  onCancelItem={handleCancelItem}
  onRetryItem={handleRetryItem}
/>
```

### 6. TemplateManager
Message template creation and management with analytics.

**Features:**
- Create/edit/delete templates
- Variable system for personalization
- Template preview with sample data
- Usage analytics and success rates
- Template duplication
- Performance tracking

```tsx
import { TemplateManager } from '@/components/automation';

<TemplateManager
  userId="user-123"
  templates={templates}
  onCreateTemplate={handleCreateTemplate}
  onUpdateTemplate={handleUpdateTemplate}
  onDeleteTemplate={handleDeleteTemplate}
/>
```

### 7. AutomationSettings
Comprehensive settings interface with LinkedIn compliance validation.

**Features:**
- Connection automation settings
- Engagement automation configuration
- Target audience filtering
- Safety thresholds and alerts
- Working hours configuration
- LinkedIn compliance guidelines

```tsx
import { AutomationSettings } from '@/components/automation';

<AutomationSettings
  userId="user-123"
  settings={automationSettings}
  onUpdateSettings={handleUpdateSettings}
/>
```

## Key Features

### LinkedIn Compliance
All components are designed with ultra-conservative rate limiting:
- **Connections**: 15/day (vs LinkedIn's 100/day limit)
- **Likes**: 30/day (vs LinkedIn's 200/day limit)  
- **Comments**: 8/day (vs LinkedIn's 50/day limit)
- **Profile Views**: 25/day (vs LinkedIn's 150/day limit)
- **Follows**: 5/day (vs LinkedIn's 30/day limit)

### Human-Like Behavior
- Randomized delays (45-180 seconds for connections)
- Working hours simulation (8-hour windows)
- Weekend activity reduction (30% of weekday limits)
- Natural variation in activity patterns

### Real-Time Updates
- WebSocket integration for live status updates
- Real-time safety monitoring
- Queue status synchronization
- Alert notifications

### Safety Systems
- Multi-tier safety scoring (0-100)
- Emergency stop at 3% error rate
- Pattern anomaly detection
- Automatic suspension triggers

## API Integration

### Required Endpoints
```typescript
// Connection automation
POST /api/v1/automation/connections/schedule
DELETE /api/v1/automation/connections/:requestId
GET /api/v1/automation/connections/stats

// Engagement automation  
POST /api/v1/automation/engagement/schedule
GET /api/v1/automation/engagement/stats

// Safety monitoring
GET /api/v1/automation/safety/status
POST /api/v1/automation/safety/stop
POST /api/v1/automation/safety/resume

// General
GET /api/v1/automation/overview
GET /api/v1/automation/status
```

### WebSocket Events
```typescript
// Real-time events via WebSocket connection
ws://localhost:3007/automation?token=${jwt_token}

// Event types:
- safety_alert: Safety threshold breaches
- queue_update: Queue item status changes  
- stats_update: Automation statistics updates
- automation_status: Enable/disable status changes
```

## TypeScript Support

All components include comprehensive TypeScript definitions:

```typescript
import type {
  AutomationDashboardProps,
  ConnectionAutomationProps,
  EngagementAutomationProps,
  SafetyStatus,
  QueueItem,
  MessageTemplate,
  AutomationSettings
} from '@/types/automation';
```

## Styling

Components use Tailwind CSS with shadcn/ui design system:
- Consistent design language
- Dark/light mode support
- Responsive layouts
- Accessibility compliance (WCAG 2.1 AA)

## Usage Example

```tsx
import React, { useState, useEffect } from 'react';
import { AutomationDashboard } from '@/components/automation';

export function AutomationPage() {
  const [user] = useUser();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="container mx-auto py-6">
      <AutomationDashboard
        userId={user.id}
        subscriptionTier={user.subscriptionTier}
        onSettingsOpen={() => setSettingsOpen(true)}
      />
    </div>
  );
}
```

## Security Considerations

- All API calls require JWT authentication
- Rate limiting enforced at component level
- Input validation and sanitization
- Safe HTML rendering for user content
- Error boundary implementation recommended

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

Requires modern JavaScript features:
- WebSocket support
- Drag and Drop API
- Modern CSS Grid/Flexbox