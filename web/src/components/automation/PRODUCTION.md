# Production Automation Components

This directory contains production-ready React components for the InErgize LinkedIn automation dashboard with enhanced features, accessibility, and performance optimizations.

## 🚀 Key Features

### Core Components
- **ProductionAutomationDashboard**: Main dashboard with real-time metrics visualization
- **ProductionSafetyMonitor**: Ultra-conservative LinkedIn compliance monitoring (15% limits)
- **EmergencyStopComponent**: Instant automation suspension with safety confirmations
- **WebSocketProvider**: Enhanced real-time connection management (port 3007)

### Production Features
- ✅ **WCAG 2.1 AA accessibility compliance**
- ✅ **Mobile-first responsive design**
- ✅ **<3s load time optimization** with lazy loading
- ✅ **Real-time WebSocket updates** with performance monitoring
- ✅ **Ultra-conservative safety limits** (15% of LinkedIn's actual limits)
- ✅ **Comprehensive error handling** and loading states
- ✅ **Health score visualization** (0-100 scale)
- ✅ **Performance monitoring** with debug metrics

## 📊 LinkedIn Safety Limits

Our ultra-conservative approach uses only **15% of LinkedIn's actual limits** to ensure maximum account safety:

| Action | Our Limit | LinkedIn's Limit | Safety Factor |
|--------|-----------|------------------|---------------|
| Connections | 15/day | ~100/day | 15% |
| Likes | 30/day | ~200/day | 15% |
| Comments | 8/day | ~50/day | 16% |
| Profile Views | 25/day | ~150/day | 17% |
| Follows | 5/day | ~30/day | 17% |

## 📱 Accessibility Features

### WCAG 2.1 AA Compliance
- **Keyboard Navigation**: Full tab navigation and keyboard shortcuts
- **Screen Reader Support**: Proper ARIA labels and descriptions
- **Color Contrast**: Minimum 4.5:1 ratio for all text
- **Focus Management**: Clear focus indicators and logical order
- **Live Regions**: Real-time updates announced to screen readers

### Keyboard Shortcuts
- `Alt + E`: Open emergency stop modal
- `Escape`: Close modals and overlays
- `Tab`/`Shift+Tab`: Navigate between interactive elements

## ⚡ Performance Optimizations

### Load Time (<3s target)
- **Lazy Loading**: Heavy components loaded on-demand
- **Code Splitting**: Automatic route-based splitting
- **Memoization**: React.memo for expensive components
- **Bundle Optimization**: Tree-shaking and compression

### Real-time Performance
- **WebSocket Pooling**: Efficient connection management
- **Performance Monitoring**: Built-in metrics tracking
- **Health Score Calculation**: 0-100 scale with multiple factors
- **Automatic Recovery**: Smart reconnection with exponential backoff

## 🔌 WebSocket Architecture

### Connection Management (Port 3007)
```typescript
// Enhanced WebSocket with performance monitoring
const wsConfig = {
  url: 'ws://localhost:3007/automation/{userId}',
  reconnect: true,
  reconnectAttempts: 15, // Enterprise: 15, Premium: 10, Free: 5
  reconnectInterval: 1000, // Enterprise: 1s, Premium: 2s, Free: 3s
  heartbeatInterval: 15000, // Enterprise: 15s, Premium: 20s, Free: 30s
};
```

### Real-time Events
- `automation_status`: Overview and metrics updates
- `safety_alert`: Critical safety notifications
- `queue_update`: Queue status changes
- `health_update`: Connection health metrics

## 🛡️ Safety Monitor Features

### Health Score Calculation (0-100)
```typescript
const healthScore = {
  base: 100,
  deductions: {
    highLatency: latency > 1000 ? -30 : latency > 500 ? -20 : -10,
    reconnectAttempts: Math.min(attempts * 5, -25),
    recentErrors: lastError ? -15 : 0,
  },
  bonus: {
    enterpriseStability: tier === 'enterprise' && attempts === 0 ? +5 : 0,
  }
};
```

### Safety Thresholds
- **Excellent**: 90-100 (Green)
- **Good**: 75-89 (Green)
- **Fair**: 60-74 (Yellow)
- **Warning**: 45-59 (Orange)
- **Critical**: 30-44 (Red)
- **Emergency**: 0-29 (Red, Auto-stop)

## 🚨 Emergency Stop Component

### Safety Features
- **Confirmation Required**: User must type "STOP" to confirm
- **10-second Delay**: Prevents accidental stops
- **Progress Tracking**: Real-time stop progress visualization
- **Keyboard Accessible**: Full keyboard navigation support
- **Focus Trapping**: Modal focus management

### Stop Process
1. **Preparing**: Validate current state
2. **Stopping Connections**: Cancel pending connection requests
3. **Stopping Engagement**: Cancel likes and comments
4. **Clearing Queue**: Remove queued automation items
5. **Completed**: All automation stopped successfully

## 📖 Usage Examples

### Basic Usage
```tsx
import { ProductionAutomationExample } from '@/components/automation';

function AutomationPage() {
  return (
    <ProductionAutomationExample
      userId="user_123"
      subscriptionTier="premium"
      onSettingsOpen={() => router.push('/settings')}
    />
  );
}
```

### Individual Components
```tsx
import { 
  WebSocketProvider,
  ProductionAutomationDashboard,
  ProductionSafetyMonitor 
} from '@/components/automation';

function CustomDashboard() {
  return (
    <WebSocketProvider userId="user_123" subscriptionTier="premium">
      <AutomationProvider userId="user_123" subscriptionTier="premium">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ProductionAutomationDashboard 
            userId="user_123"
            subscriptionTier="premium"
          />
          <ProductionSafetyMonitor 
            userId="user_123"
            subscriptionTier="premium"
          />
        </div>
      </AutomationProvider>
    </WebSocketProvider>
  );
}
```

### Emergency Stop Usage
```tsx
import { EmergencyStopComponent } from '@/components/automation';

function MyComponent() {
  const [showEmergencyStop, setShowEmergencyStop] = useState(false);
  const { emergencyStop } = useAutomation();

  return (
    <>
      <Button onClick={() => setShowEmergencyStop(true)}>
        Emergency Stop
      </Button>
      
      <EmergencyStopComponent
        isOpen={showEmergencyStop}
        onClose={() => setShowEmergencyStop(false)}
        onConfirm={emergencyStop}
        currentStatus="active"
      />
    </>
  );
}
```

## 🔧 Configuration

### WebSocket Provider Props
```typescript
interface WebSocketProviderProps {
  userId: string;
  subscriptionTier: 'free' | 'premium' | 'enterprise';
  enablePerformanceMonitoring?: boolean; // Default: true
  maxReconnectAttempts?: number; // Auto-configured by tier
  reconnectInterval?: number; // Auto-configured by tier  
  heartbeatInterval?: number; // Auto-configured by tier
}
```

### Dashboard Props
```typescript
interface ProductionAutomationDashboardProps {
  userId: string;
  subscriptionTier: 'free' | 'premium' | 'enterprise';
  onSettingsOpen?: () => void;
  className?: string;
}
```

## 🐛 Debug Features

### Development Mode
```typescript
// Performance debug info (development only)
if (process.env.NODE_ENV === 'development') {
  console.log('📊 WebSocket Performance:', {
    healthScore,
    latency,
    averageLatency,
    messagesSent,
    messagesReceived,
    reconnectAttempts,
  });
}
```

### Debug Panel
The dashboard includes a collapsible debug panel in development mode showing:
- Render performance metrics
- WebSocket connection stats
- Component state information
- Performance optimization suggestions

## 🔄 Migration from Legacy Components

### Component Mapping
- `AutomationDashboard` → `ProductionAutomationDashboard`
- `EnhancedSafetyMonitor` → `ProductionSafetyMonitor`
- New: `EmergencyStopComponent`
- New: `WebSocketProvider`

### Breaking Changes
1. **WebSocket Provider Required**: Must wrap components with `WebSocketProvider`
2. **New Props**: `subscriptionTier` now required for all components
3. **Enhanced Types**: New type definitions for production features

### Migration Steps
1. Import new components from `/automation` index
2. Wrap your app/page with `WebSocketProvider`
3. Update component props to include `subscriptionTier`
4. Remove legacy WebSocket handling code
5. Test accessibility with screen readers
6. Verify performance meets <3s load target

## 📈 Performance Metrics

### Target Metrics
- **First Contentful Paint**: <1.5s
- **Largest Contentful Paint**: <2.5s
- **Cumulative Layout Shift**: <0.1
- **Time to Interactive**: <3.0s
- **WebSocket Connection**: <500ms

### Monitoring
Built-in performance monitoring tracks:
- Component render times
- WebSocket latency and throughput
- Memory usage patterns
- Error rates and recovery times

## 🛠️ Development

### Required Dependencies
```json
{
  "react": "^18.0.0",
  "next": "^15.0.0",
  "@types/react": "^18.0.0",
  "tailwindcss": "^4.0.0",
  "lucide-react": "latest"
}
```

### Environment Variables
```bash
# WebSocket configuration
NEXT_PUBLIC_WS_URL=ws://localhost:3007
NEXT_PUBLIC_ENABLE_DEBUG=true

# LinkedIn API limits (for reference)
LINKEDIN_DAILY_CONNECTION_LIMIT=100
LINKEDIN_DAILY_LIKE_LIMIT=200
LINKEDIN_DAILY_COMMENT_LIMIT=50
```

---

## 📝 License

Part of the InErgize LinkedIn automation platform. See main project license for details.

## 🤝 Contributing

1. Follow existing code patterns and conventions
2. Ensure WCAG 2.1 AA compliance for new features
3. Add comprehensive TypeScript types
4. Include performance optimizations
5. Write accessible, semantic HTML
6. Test with keyboard navigation and screen readers

---

*Generated with production-ready React components focusing on accessibility, performance, and LinkedIn compliance.*