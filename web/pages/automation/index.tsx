import React from 'react';
import AppLayout from '../../components/Layout/AppLayout';
import { ProductionAutomationDashboard } from '../../src/components/automation/ProductionAutomationDashboard';

const AutomationPage: React.FC = () => {
  return (
    <AppLayout showSidebar={true}>
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">LinkedIn Automation</h1>
          <p className="text-gray-600">Safely automate your LinkedIn activities with ultra-conservative compliance</p>
        </div>
        <ProductionAutomationDashboard />
      </div>
    </AppLayout>
  );
};

export default AutomationPage;