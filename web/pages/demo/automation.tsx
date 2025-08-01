import React from 'react';
import { AutomationDashboardV3 } from '../../src/components/automation/AutomationDashboardV3';
import { EnhancedSafetyMonitor } from '../../src/components/automation/EnhancedSafetyMonitor';
import { EnhancedTemplateManager } from '../../src/components/automation/EnhancedTemplateManager';
import { EnhancedQueueManager } from '../../src/components/automation/EnhancedQueueManager';

const AutomationDemoPage: React.FC = () => {
  // Demo data for testing
  const demoSafetyData = {
    overall_score: 92,
    compliance_score: 95,
    engagement_score: 88,
    velocity_score: 90,
    risk_factors: [],
    alerts: [],
    last_updated: new Date().toISOString()
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 py-8 mx-auto max-w-7xl sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">InErgize Automation Demo</h1>
          <p className="mt-2 text-gray-600">Phase 3 Components - Ultra-Conservative LinkedIn Automation</p>
        </div>

        {/* Main Dashboard */}
        <div className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold text-gray-800">Automation Dashboard</h2>
          <AutomationDashboardV3 />
        </div>

        {/* Individual Components */}
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Safety Monitor */}
          <div>
            <h2 className="mb-4 text-xl font-semibold text-gray-800">Safety Monitor</h2>
            <EnhancedSafetyMonitor 
              safetyData={demoSafetyData}
              userId="demo-user"
              onEmergencyStop={() => alert('Emergency Stop Activated!')}
              subscriptionTier="professional"
            />
          </div>

          {/* Template Manager */}
          <div>
            <h2 className="mb-4 text-xl font-semibold text-gray-800">Template Manager</h2>
            <EnhancedTemplateManager userId="demo-user" />
          </div>

          {/* Queue Manager */}
          <div className="lg:col-span-2">
            <h2 className="mb-4 text-xl font-semibold text-gray-800">Queue Manager</h2>
            <EnhancedQueueManager userId="demo-user" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutomationDemoPage;