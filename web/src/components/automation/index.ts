/**
 * LinkedIn Automation UI Components
 * 
 * Comprehensive automation components for the InErgize web app including:
 * - Connection request automation
 * - Engagement automation (likes, comments, views, follows)
 * - Real-time safety monitoring with alerts
 * - Queue management with drag-and-drop
 * - Template management with success analytics
 * - Configuration settings with LinkedIn compliance
 */

export { AutomationDashboard } from './AutomationDashboard';
export { ConnectionAutomation } from './ConnectionAutomation';
export { EngagementAutomation } from './EngagementAutomation';
export { SafetyMonitorWidget } from './SafetyMonitorWidget';
export { AutomationQueuePanel } from './AutomationQueuePanel';
export { TemplateManager } from './TemplateManager';
export { AutomationSettings } from './AutomationSettings';

// Re-export types for convenience
export type {
  AutomationDashboardProps,
  ConnectionAutomationProps,
  EngagementAutomationProps,
  SafetyMonitorProps,
  QueuePanelProps,
  TemplateManagerProps,
  AutomationSettingsProps,
  ConnectionRequest,
  EngagementTask,
  SafetyStatus,
  SafetyAlert,
  MessageTemplate,
  QueueItem,
  AutomationOverview,
  AutomationSettings as AutomationSettingsType,
  AutomationEvent,
  SafetyAlertEvent,
  QueueUpdateEvent,
  StatsUpdateEvent,
  AutomationStatusEvent
} from '@/types/automation';