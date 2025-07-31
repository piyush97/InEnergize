// Legacy components
export { AutomationDashboard } from './AutomationDashboard';
export { EnhancedSafetyMonitor } from './EnhancedSafetyMonitor';
export { EnhancedQueueManager } from './EnhancedQueueManager';
export { EnhancedTemplateManager } from './EnhancedTemplateManager';
export { ConnectionAutomation } from './ConnectionAutomation';
export { EngagementAutomation } from './EngagementAutomation';
export { SafetyMonitorWidget } from './SafetyMonitorWidget';
export { AutomationQueuePanel } from './AutomationQueuePanel';
export { TemplateManager } from './TemplateManager';
export { AutomationSettings } from './AutomationSettings';

// Production-ready components with enhanced features
export { default as ProductionAutomationDashboard } from './ProductionAutomationDashboard';
export { default as ProductionSafetyMonitor } from './ProductionSafetyMonitor';
export { default as EmergencyStopComponent } from './EmergencyStopComponent';

// Enhanced context providers
export { WebSocketProvider, useWebSocket, useWebSocketEvent } from '../../contexts/WebSocketProvider';