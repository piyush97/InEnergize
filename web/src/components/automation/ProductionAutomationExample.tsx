"use client";

import React from 'react';
import { WebSocketProvider } from '@/contexts/WebSocketProvider';
import { AutomationProvider } from '@/contexts/AutomationContext';
import { ProductionAutomationDashboard } from './index';

/**
 * Production Automation Example
 * 
 * This component demonstrates how to use the production-ready automation
 * components with proper provider wrapping and configuration.
 * 
 * Features:
 * - Real-time WebSocket connection to port 3007
 * - Ultra-conservative LinkedIn safety limits (15% of LinkedIn's limits)
 * - WCAG 2.1 AA accessibility compliance
 * - Mobile-first responsive design
 * - <3s load time optimization with lazy loading
 * - Comprehensive error handling and loading states
 */

interface ProductionAutomationExampleProps {
  userId: string;
  subscriptionTier: 'free' | 'premium' | 'enterprise';
  onSettingsOpen?: () => void;
}

export default function ProductionAutomationExample({
  userId,
  subscriptionTier,
  onSettingsOpen
}: ProductionAutomationExampleProps) {
  return (
    <WebSocketProvider
      userId={userId}
      subscriptionTier={subscriptionTier}
      enablePerformanceMonitoring={process.env.NODE_ENV === 'development'}
      maxReconnectAttempts={subscriptionTier === 'enterprise' ? 15 : 10}
      reconnectInterval={subscriptionTier === 'enterprise' ? 1000 : 2000}
      heartbeatInterval={subscriptionTier === 'enterprise' ? 15000 : 20000}
    >
      <AutomationProvider
        userId={userId}
        subscriptionTier={subscriptionTier}
      >
        <div className="min-h-screen bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <ProductionAutomationDashboard
              userId={userId}
              subscriptionTier={subscriptionTier}
              onSettingsOpen={onSettingsOpen}
              className="space-y-6"
            />
          </div>
        </div>
      </AutomationProvider>
    </WebSocketProvider>
  );
}

/**
 * Usage Example:
 * 
 * ```tsx
 * import { ProductionAutomationExample } from '@/components/automation';
 * 
 * function MyPage() {
 *   return (
 *     <ProductionAutomationExample
 *       userId="user_123"
 *       subscriptionTier="premium"
 *       onSettingsOpen={() => console.log('Open settings')}
 *     />
 *   );
 * }
 * ```
 */

/**
 * Individual Component Usage:
 * 
 * If you want to use components individually, wrap them with the appropriate providers:
 * 
 * ```tsx
 * import { 
 *   WebSocketProvider, 
 *   ProductionSafetyMonitor,
 *   EmergencyStopComponent 
 * } from '@/components/automation';
 * 
 * function SafetyPage() {
 *   return (
 *     <WebSocketProvider userId="user_123" subscriptionTier="premium">
 *       <AutomationProvider userId="user_123" subscriptionTier="premium">
 *         <ProductionSafetyMonitor 
 *           userId="user_123" 
 *           subscriptionTier="premium" 
 *         />
 *       </AutomationProvider>
 *     </WebSocketProvider>
 *   );
 * }
 * ```
 */