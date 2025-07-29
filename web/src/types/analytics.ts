/**
 * Enhanced Analytics types for LinkedIn optimization platform
 * Comprehensive type definitions for metrics, charts, and predictive analytics
 */

import type {
  BaseComponentProps,
  AsyncState,
  TimeRange,
  UserId,
  PerformanceMetrics
} from './common';

// ===== CORE ANALYTICS TYPES =====

export interface ProfileAnalytics {
  userId: UserId;
  timeRange: TimeRange;
  lastUpdated: Date;
  dataQuality: DataQuality;
  summary: AnalyticsSummary;
  chartData: ChartDataCollection;
  insights: AnalyticsInsights;
  benchmarks: IndustryBenchmarks;
  predictions: PredictiveAnalytics;
  performance: PerformanceMetrics;
}

export interface DataQuality {
  completeness: number; // 0-100 percentage
  accuracy: number; // 0-100 percentage
  freshness: number; // minutes since last update
  reliability: 'high' | 'medium' | 'low';
  sources: DataSource[];
  lastValidation: Date;
}

export interface DataSource {
  name: string;
  type: 'linkedin_api' | 'scraping' | 'user_input' | 'calculated';
  reliability: number; // 0-100
  lastUpdate: Date;
  status: 'active' | 'stale' | 'error';
}

export interface AnalyticsSummary {
  profileViews: MetricSummary;
  searchAppearances: MetricSummary;
  connections: MetricSummary;
  engagementRate: MetricSummary;
  completenessScore: MetricSummary;
  industryRank: RankingSummary;
  growthRate: GrowthSummary;
}

export interface MetricSummary {
  current: number;
  previous: number;
  change: number;
  changePercentage: number;
  trend: TrendDirection;
  goalProgress?: GoalProgress;
  benchmark?: BenchmarkComparison;
}

export type TrendDirection = 'up' | 'down' | 'stable' | 'volatile';

export interface GoalProgress {
  target: number;
  current: number;
  percentage: number;
  onTrack: boolean;
  estimatedCompletion?: Date;
}

export interface BenchmarkComparison {
  industry: number;
  role: number;
  company: number;
  percentile: number;
  status: 'above' | 'at' | 'below';
}

export interface RankingSummary {
  overall: number;
  industry: number;
  location: number;
  company: number;
  improvement: number;
}

export interface GrowthSummary {
  daily: number;
  weekly: number;
  monthly: number;
  quarterly: number;
  yearOverYear: number;
  acceleration: number; // rate of change of growth rate
}

// ===== CHART DATA TYPES =====

export interface ChartDataCollection {
  profileViews: ChartDataPoint[];
  searchAppearances: ChartDataPoint[];
  connections: ChartDataPoint[];
  engagementRate: ChartDataPoint[];
  completenessScore: ChartDataPoint[];
  industryComparison: ComparisonChartData[];
  heatmaps: HeatmapData[];
  distribution: DistributionData[];
}

export interface ChartDataPoint {
  timestamp: Date;
  value: number;
  label?: string;
  metadata?: ChartPointMetadata;
}

export interface ChartPointMetadata {
  events?: string[]; // significant events that may have affected metrics
  confidence?: number; // data confidence level
  source?: string;
  annotations?: string[];
}

export interface ComparisonChartData {
  category: string;
  current: number;
  benchmark: number;
  percentile: number;
  industry: string;
  sampleSize: number;
}

export interface HeatmapData {
  type: 'time_of_day' | 'day_of_week' | 'content_type' | 'industry';
  data: HeatmapCell[];
  gradient: ColorGradient;
}

export interface HeatmapCell {
  x: string | number;
  y: string | number;
  value: number;
  count?: number;
  label?: string;
}

export interface ColorGradient {
  low: string;
  medium: string;
  high: string;
  steps: number;
}

export interface DistributionData {
  metric: string;
  buckets: DistributionBucket[];
  statistics: DistributionStatistics;
}

export interface DistributionBucket {
  min: number;
  max: number;
  count: number;
  percentage: number;
  label: string;
}

export interface DistributionStatistics {
  mean: number;
  median: number;
  mode: number;
  standardDeviation: number;
  skewness: number;
  kurtosis: number;
}

// ===== INSIGHTS AND RECOMMENDATIONS =====

export interface AnalyticsInsights {
  key: KeyInsight[];
  trends: TrendInsight[];
  opportunities: OpportunityInsight[];
  alerts: AlertInsight[];
  achievements: Achievement[];
  recommendations: Recommendation[];
}

export interface KeyInsight {
  id: string;
  type: 'positive' | 'negative' | 'neutral' | 'action_required';
  title: string;
  description: string;
  impact: InsightImpact;
  confidence: number; // 0-100
  timeframe: string;
  metrics: string[];
  evidence: InsightEvidence[];
}

export type InsightImpact = 'high' | 'medium' | 'low';

export interface InsightEvidence {
  type: 'data_point' | 'correlation' | 'external_factor' | 'user_action';
  description: string;
  value?: number;
  source: string;
}

export interface TrendInsight {
  id: string;
  metric: string;
  direction: TrendDirection;
  strength: 'strong' | 'moderate' | 'weak';
  duration: string;
  projection: TrendProjection;
  causes: TrendCause[];
}

export interface TrendProjection {
  timeframe: string;
  projectedValue: number;
  confidence: number;
  scenarios: ProjectionScenario[];
}

export interface ProjectionScenario {
  name: string;
  probability: number;
  value: number;
  conditions: string[];
}

export interface TrendCause {
  factor: string;
  correlation: number; // -1 to 1
  confidence: number; // 0-100
  explanation: string;
}

export interface OpportunityInsight {
  id: string;
  title: string;
  description: string;
  potential: OpportunityPotential;
  effort: OpportunityEffort;
  timeframe: string;
  actions: ActionItem[];
  success_metrics: string[];
}

export type OpportunityPotential = 'high' | 'medium' | 'low';
export type OpportunityEffort = 'high' | 'medium' | 'low';

export interface ActionItem {
  id: string;
  action: string;
  priority: 'high' | 'medium' | 'low';
  estimatedImpact: number;
  effort: OpportunityEffort;
  deadline?: Date;
  dependencies?: string[];
}

export interface AlertInsight {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  metric: string;
  threshold: number;
  currentValue: number;
  triggered: Date;
  actions: string[];
  autoResolve: boolean;
}

export interface Achievement {
  id: string;
  type: 'milestone' | 'improvement' | 'ranking' | 'goal_completed';
  title: string;
  description: string;
  earnedAt: Date;
  metric: string;
  value: number;
  badge?: string;
  shareable: boolean;
}

export interface Recommendation {
  id: string;
  category: RecommendationCategory;
  title: string;
  description: string;
  rationale: string;
  impact: RecommendationImpact;
  effort: RecommendationEffort;
  priority: number; // 1-10 scale
  actions: RecommendationAction[];
  expectedOutcome: ExpectedOutcome;
  deadline?: Date;
  dependencies?: string[];
}

export type RecommendationCategory = 
  | 'profile_optimization'
  | 'content_strategy'
  | 'networking'
  | 'engagement'
  | 'visibility'
  | 'industry_positioning';

export interface RecommendationImpact {
  metric: string;
  estimatedIncrease: number;
  timeframe: string;
  confidence: number;
}

export interface RecommendationEffort {
  level: 'low' | 'medium' | 'high';
  timeRequired: string;
  skillsRequired: string[];
  toolsRequired: string[];
}

export interface RecommendationAction {
  id: string;
  description: string;
  type: 'profile_update' | 'content_creation' | 'engagement' | 'settings_change';
  parameters?: Record<string, unknown>;
  order: number;
  estimated_time: string;
}

export interface ExpectedOutcome {
  primaryMetric: string;
  estimatedChange: number;
  timeframe: string;
  confidence: number;
  secondaryEffects: SecondaryEffect[];
}

export interface SecondaryEffect {
  metric: string;
  estimatedChange: number;
  likelihood: number;
}

// ===== BENCHMARKING =====

export interface IndustryBenchmarks {
  industry: string;
  sampleSize: number;
  lastUpdated: Date;
  metrics: BenchmarkMetric[];
  percentiles: PercentileData;
  trends: BenchmarkTrend[];
  competitivePosition: CompetitivePosition;
}

export interface BenchmarkMetric {
  name: string;
  userValue: number;
  industryAverage: number;
  industryMedian: number;
  topPercentile: number; // 90th percentile
  bottomPercentile: number; // 10th percentile
  userPercentile: number;
  status: 'excellent' | 'above_average' | 'average' | 'below_average' | 'poor';
}

export interface PercentileData {
  overall: number;
  profileViews: number;
  connections: number;
  engagement: number;
  growth: number;
  activity: number;
}

export interface BenchmarkTrend {
  metric: string;
  industryGrowth: number;
  userGrowth: number;
  gapTrend: 'closing' | 'stable' | 'widening';
  projectedPosition: number;
}

export interface CompetitivePosition {
  rank: number;
  totalProfiles: number;
  percentile: number;
  nearestCompetitors: CompetitorProfile[];
  strengthAreas: string[];
  improvementAreas: string[];
}

export interface CompetitorProfile {
  id: string;
  industry: string;
  role: string;
  rank: number;
  keyMetrics: Record<string, number>;
  strengths: string[];
}

// ===== PREDICTIVE ANALYTICS =====

export interface PredictiveAnalytics {
  models: PredictionModel[];
  forecasts: MetricForecast[];
  scenarios: ScenarioAnalysis[];
  recommendations: PredictiveRecommendation[];
  confidence: ModelConfidence;
  lastTrained: Date;
}

export interface PredictionModel {
  id: string;
  name: string;
  type: 'linear_regression' | 'arima' | 'neural_network' | 'ensemble';
  accuracy: number; // 0-100
  features: string[];
  target: string;
  trainingPeriod: string;
  version: string;
  status: 'active' | 'training' | 'deprecated';
}

export interface MetricForecast {
  metric: string;
  model: string;
  timeframe: ForecastTimeframe;
  predictions: ForecastPoint[];
  confidence_intervals: ConfidenceInterval[];
  assumptions: string[];
  risk_factors: RiskFactor[];
}

export interface ForecastTimeframe {
  start: Date;
  end: Date;
  granularity: 'daily' | 'weekly' | 'monthly';
  horizon: string; // e.g., "30 days", "3 months"
}

export interface ForecastPoint {
  date: Date;
  predicted_value: number;
  lower_bound: number;
  upper_bound: number;
  confidence: number;
}

export interface ConfidenceInterval {
  date: Date;
  level: number; // e.g., 95 for 95% confidence
  lower: number;
  upper: number;
}

export interface RiskFactor {
  name: string;
  impact: 'positive' | 'negative';
  likelihood: number; // 0-100
  magnitude: number;
  description: string;
}

export interface ScenarioAnalysis {
  name: string;
  description: string;
  probability: number;
  conditions: ScenarioCondition[];
  outcomes: ScenarioOutcome[];
  recommendations: string[];
}

export interface ScenarioCondition {
  variable: string;
  condition: string;
  value: number;
  probability: number;
}

export interface ScenarioOutcome {
  metric: string;
  expectedValue: number;
  range: {
    min: number;
    max: number;
  };
  timeframe: string;
}

export interface PredictiveRecommendation {
  id: string;
  title: string;
  description: string;
  model_confidence: number;
  expected_impact: PredictedImpact;
  optimal_timing: OptimalTiming;
  action_plan: ActionPlan;
}

export interface PredictedImpact {
  metric: string;
  magnitude: number;
  timeframe: string;
  probability: number;
  confidence_interval: {
    lower: number;
    upper: number;
  };
}

export interface OptimalTiming {
  start_date: Date;
  duration: string;
  factors: TimingFactor[];
}

export interface TimingFactor {
  name: string;
  influence: number; // -1 to 1
  description: string;
}

export interface ActionPlan {
  steps: PlanStep[];
  milestones: Milestone[];
  success_criteria: SuccessCriteria[];
}

export interface PlanStep {
  order: number;
  action: string;
  duration: string;
  dependencies: string[];
  expected_outcome: string;
}

export interface Milestone {
  name: string;
  target_date: Date;
  metric: string;
  target_value: number;
  critical: boolean;
}

export interface SuccessCriteria {
  metric: string;
  threshold: number;
  operator: 'greater_than' | 'less_than' | 'equals';
  timeframe: string;
}

export interface ModelConfidence {
  overall: number;
  by_metric: Record<string, number>;
  by_timeframe: Record<string, number>;
  factors: ConfidenceFactor[];
}

export interface ConfidenceFactor {
  name: string;
  impact: number; // -1 to 1, effect on confidence
  description: string;
}

// ===== COMPONENT PROPS =====

export interface AnalyticsChartProps extends BaseComponentProps {
  timeRange?: TimeRange;
  metrics?: string[];
  showPredictions?: boolean;
  interactive?: boolean;
  height?: number;
  showLegend?: boolean;
  theme?: 'light' | 'dark';
}

export interface AnalyticsDashboardProps extends BaseComponentProps {
  userId: UserId;
  refreshInterval?: number;
  showAdvancedMetrics?: boolean;
  compactView?: boolean;
  customizations?: DashboardCustomization;
}

export interface DashboardCustomization {
  layout: 'grid' | 'list' | 'masonry';
  widgets: WidgetConfiguration[];
  theme: 'light' | 'dark' | 'auto';
  refreshRate: number;
}

export interface WidgetConfiguration {
  id: string;
  type: string;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  config: Record<string, unknown>;
  visible: boolean;
}

export interface MetricsWidgetProps extends BaseComponentProps {
  metrics: string[];
  timeRange: TimeRange;
  showComparison?: boolean;
  showTrends?: boolean;
  format?: 'compact' | 'detailed';
}

export interface InsightsWidgetProps extends BaseComponentProps {
  insights: AnalyticsInsights;
  maxInsights?: number;
  categories?: string[];
  interactive?: boolean;
}

export interface BenchmarkWidgetProps extends BaseComponentProps {
  benchmarks: IndustryBenchmarks;
  metrics?: string[];
  showPercentiles?: boolean;
  comparisonMode?: 'industry' | 'role' | 'company';
}

export interface PredictiveWidgetProps extends BaseComponentProps {
  predictions: PredictiveAnalytics;
  metric: string;
  timeframe: string;
  showConfidence?: boolean;
  showScenarios?: boolean;
}

// ===== UTILITY TYPES =====

export interface AnalyticsFilters {
  timeRange: TimeRange;
  metrics: string[];
  granularity: 'hour' | 'day' | 'week' | 'month';
  compareWith?: ComparisonPeriod;
  segments?: AnalyticsSegment[];
}

export interface ComparisonPeriod {
  type: 'previous_period' | 'year_over_year' | 'custom';
  customStart?: Date;
  customEnd?: Date;
}

export interface AnalyticsSegment {
  dimension: string;
  values: string[];
  operator: 'include' | 'exclude';
}

export interface AnalyticsQuery {
  metrics: string[];
  dimensions?: string[];
  filters?: AnalyticsFilters;
  sort?: SortOption[];
  limit?: number;
  offset?: number;
}

export interface SortOption {
  field: string;
  direction: 'asc' | 'desc';
}

export interface AnalyticsExportOptions {
  format: 'csv' | 'xlsx' | 'json' | 'pdf';
  includeCharts: boolean;
  includeInsights: boolean;
  includeBenchmarks: boolean;
  dateRange: {
    start: Date;
    end: Date;
  };
  metrics?: string[];
}

// ===== REAL-TIME TYPES =====

export interface RealTimeMetrics {
  timestamp: Date;
  metrics: Record<string, number>;
  deltas: Record<string, number>;
  alerts: string[];
  status: 'normal' | 'anomaly' | 'error';
}

export interface MetricsWebSocketMessage {
  type: 'metrics_update' | 'alert' | 'insight' | 'benchmark_update';
  payload: unknown;
  timestamp: Date;
  userId: UserId;
}

export interface AnalyticsState extends AsyncState<ProfileAnalytics> {
  realTimeMetrics: RealTimeMetrics | null;
  websocketConnected: boolean;
  lastUpdate: Date;
  updateFrequency: number;
}