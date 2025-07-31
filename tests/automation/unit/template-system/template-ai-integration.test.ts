/**
 * Template System & AI Integration - Testing Suite
 * 
 * Tests for template management, AI content generation, performance analytics,
 * success rate tracking, and compliance validation
 */

import { TemplateManagerService } from '../../../../../services/linkedin-service/src/services/templateManager.service';
import { AIContentService } from '../../../../../services/ai-service/src/services/aiContent.service';
import { SafetyMonitorService } from '../../../../../services/linkedin-service/src/services/safetyMonitor.service';
import { MessageTemplate, TemplateAnalytics, ContentGenerationRequest } from '../../../../../services/linkedin-service/src/types/templates';
import Redis from 'ioredis';

// Mock dependencies
jest.mock('ioredis');
jest.mock('../../../../../services/ai-service/src/services/aiContent.service');
jest.mock('../../../../../services/linkedin-service/src/services/safetyMonitor.service');

const MockedRedis = Redis as jest.MockedClass<typeof Redis>;
const MockedAIContentService = AIContentService as jest.MockedClass<typeof AIContentService>;
const MockedSafetyMonitorService = SafetyMonitorService as jest.MockedClass<typeof SafetyMonitorService>;

describe('TemplateManagerService - Template & AI Integration Tests', () => {
  let templateManager: TemplateManagerService;
  let mockRedis: jest.Mocked<Redis>;
  let mockAIService: jest.Mocked<AIContentService>;
  let mockSafetyMonitor: jest.Mocked<SafetyMonitorService>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Redis
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      setex: jest.fn(),
      hget: jest.fn(),
      hset: jest.fn(),
      hgetall: jest.fn(),
      incr: jest.fn(),
      lpush: jest.fn(),
      lrange: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
      ping: jest.fn().mockResolvedValue('PONG'),
      quit: jest.fn()
    } as any;

    MockedRedis.mockImplementation(() => mockRedis);

    // Mock AI Content Service
    mockAIService = {
      generateConnectionMessage: jest.fn(),
      generateCommentContent: jest.fn(),
      analyzeContentCompliance: jest.fn(),
      improveTemplateContent: jest.fn(),
      generateTemplateVariations: jest.fn(),
      analyzeTemplatePerformance: jest.fn(),
      disconnect: jest.fn()
    } as any;

    MockedAIContentService.mockImplementation(() => mockAIService);

    // Mock Safety Monitor
    mockSafetyMonitor = {
      evaluateSpamRisk: jest.fn(),
      validateConnectionAuthenticity: jest.fn(),
      evaluateComplianceRisk: jest.fn(),
      disconnect: jest.fn()
    } as any;

    MockedSafetyMonitorService.mockImplementation(() => mockSafetyMonitor);

    templateManager = new TemplateManagerService();
  });

  afterEach(async () => {
    await templateManager.disconnect();
  });

  describe('Template Management', () => {
    describe('Template Creation and Validation', () => {
      it('should create templates with AI compliance validation', async () => {
        const templateData = {
          userId: 'template-user-1',
          name: 'Professional Connection Request',
          type: 'connection' as const,
          content: 'Hi {{firstName}}, I noticed we share similar interests in {{industry}}. Would love to connect!',
          variables: ['firstName', 'industry'],
          category: 'professional',
          isActive: true
        };

        // Mock AI compliance check passes
        mockAIService.analyzeContentCompliance.mockResolvedValue({
          isCompliant: true,
          score: 0.92,
          issues: [],
          suggestions: []
        });

        // Mock safety monitor approval
        mockSafetyMonitor.evaluateSpamRisk.mockResolvedValue({
          riskLevel: 'LOW',
          shouldBlock: false,
          reasons: [],
          score: 0.15
        });

        const result = await templateManager.createTemplate(templateData);

        expect(result.success).toBe(true);
        expect(result.template).toBeDefined();
        expect(result.template.complianceScore).toBe(0.92);
        expect(mockAIService.analyzeContentCompliance).toHaveBeenCalledWith(
          templateData.content,
          { type: 'connection', context: 'linkedin' }
        );
        expect(mockSafetyMonitor.evaluateSpamRisk).toHaveBeenCalled();
      });

      it('should reject templates with low compliance scores', async () => {
        const templateData = {
          userId: 'template-user-2',
          name: 'Promotional Message',
          type: 'connection' as const,
          content: 'BUY NOW! Amazing opportunity! Click here for instant success! $$$ GUARANTEED $$$',
          variables: [],
          category: 'promotional',
          isActive: true
        };

        // Mock AI compliance check fails
        mockAIService.analyzeContentCompliance.mockResolvedValue({
          isCompliant: false,
          score: 0.25,
          issues: [
            'Excessive promotional language',
            'Spam-like keywords detected',
            'Low personalization potential'
          ],
          suggestions: [
            'Remove excessive capitalization',
            'Focus on value proposition',
            'Add personalization variables'
          ]
        });

        // Mock safety monitor flags as high risk
        mockSafetyMonitor.evaluateSpamRisk.mockResolvedValue({
          riskLevel: 'HIGH',
          shouldBlock: true,
          reasons: ['PROMOTIONAL_CONTENT', 'SPAM_KEYWORDS'],
          score: 0.87
        });

        const result = await templateManager.createTemplate(templateData);

        expect(result.success).toBe(false);
        expect(result.error).toContain('compliance');
        expect(result.complianceIssues).toHaveLength(3);
        expect(result.suggestions).toHaveLength(3);
      });

      it('should validate template variables and syntax', async () => {
        const templateData = {
          userId: 'template-user-3',
          name: 'Variable Test Template',
          type: 'connection' as const,
          content: 'Hi {{firstName}}, I see you work at {{company}} as a {{role}}. {{invalidVariable}} {{unclosedVariable',
          variables: ['firstName', 'company', 'role'],
          category: 'professional',
          isActive: true
        };

        mockAIService.analyzeContentCompliance.mockResolvedValue({
          isCompliant: true,
          score: 0.85,
          issues: [],
          suggestions: []
        });

        const result = await templateManager.createTemplate(templateData);

        expect(result.success).toBe(false);
        expect(result.error).toContain('syntax');
        expect(result.syntaxErrors).toContain('invalidVariable');
        expect(result.syntaxErrors).toContain('unclosedVariable');
      });

      it('should handle template duplication prevention', async () => {
        const templateData = {
          userId: 'template-user-4',
          name: 'Duplicate Test',
          type: 'connection' as const,
          content: 'This is a test template for duplication',
          variables: [],
          category: 'test',
          isActive: true
        };

        // Mock existing template with same content hash
        mockRedis.get.mockImplementation((key: string) => {
          if (key.includes('content_hash')) {
            return Promise.resolve('existing-template-id');
          }
          return Promise.resolve(null);
        });

        const result = await templateManager.createTemplate(templateData);

        expect(result.success).toBe(false);
        expect(result.error).toContain('duplicate');
        expect(result.existingTemplateId).toBe('existing-template-id');
      });
    });

    describe('Template Analytics and Performance Tracking', () => {
      it('should track template usage and success rates', async () => {
        const templateId = 'template-analytics-1';
        const userId = 'analytics-user';

        // Mock template usage data
        mockRedis.hgetall.mockResolvedValue({
          totalUsage: '150',
          successfulConnections: '120',
          rejectedConnections: '25',
          noResponse: '5',
          avgResponseTime: '2.5',
          lastUsed: String(Date.now())
        });

        // Mock detailed analytics from time series data
        mockRedis.lrange.mockResolvedValue([
          JSON.stringify({ timestamp: Date.now() - 86400000, success: true, responseTime: 2.1 }),
          JSON.stringify({ timestamp: Date.now() - 43200000, success: true, responseTime: 1.8 }),
          JSON.stringify({ timestamp: Date.now() - 21600000, success: false, reason: 'rejected' })
        ]);

        const analytics = await templateManager.getTemplateAnalytics(templateId, userId);

        expect(analytics.totalUsage).toBe(150);
        expect(analytics.successRate).toBe(0.8); // 120/150
        expect(analytics.rejectionRate).toBe(0.167); // 25/150 (rounded)
        expect(analytics.avgResponseTime).toBe(2.5);
        expect(analytics.performanceTrend).toBeDefined();
        expect(analytics.lastUsed).toBeDefined();
      });

      it('should generate performance insights and recommendations', async () => {
        const templateId = 'template-insights-1';
        const userId = 'insights-user';

        // Mock performance data showing declining success rate
        const performanceData = {
          recentSuccessRate: 0.65,
          historicalSuccessRate: 0.85,
          avgResponseTime: 3.2,
          totalUsage: 200,
          trendDirection: 'declining'
        };

        mockAIService.analyzeTemplatePerformance.mockResolvedValue({
          insights: [
            'Success rate has declined by 23% over the past month',
            'Response time is 28% slower than top-performing templates',
            'Template performs better with senior professionals'
          ],
          recommendations: [
            'Consider updating the opening line to be more engaging',
            'Add personalization variables for company size or industry',
            'Test A/B variations with different tone of voice'
          ],
          optimizationScore: 0.72,
          competitorAnalysis: {
            relativePerfomance: 'below_average',
            suggestedImprovements: ['Increase personalization', 'Shorten message length']
          }
        });

        const insights = await templateManager.generateTemplateInsights(templateId, userId);

        expect(insights.insights).toHaveLength(3);
        expect(insights.recommendations).toHaveLength(3);
        expect(insights.optimizationScore).toBe(0.72);
        expect(insights.competitorAnalysis).toBeDefined();
        expect(mockAIService.analyzeTemplatePerformance).toHaveBeenCalledWith(
          templateId,
          expect.objectContaining(performanceData)
        );
      });

      it('should segment performance by target demographics', async () => {
        const templateId = 'template-segments-1';
        const userId = 'segments-user';

        // Mock segmented analytics data
        mockRedis.hgetall.mockImplementation((key: string) => {
          if (key.includes('segment:senior')) {
            return Promise.resolve({
              usage: '50',
              success: '42',
              avgResponseTime: '1.8'
            });
          }
          if (key.includes('segment:manager')) {
            return Promise.resolve({
              usage: '75',
              success: '58',
              avgResponseTime: '2.3'
            });
          }
          if (key.includes('segment:junior')) {
            return Promise.resolve({
              usage: '25',
              success: '15',
              avgResponseTime: '3.1'
            });
          }
          return Promise.resolve({});
        });

        const segmentedAnalytics = await templateManager.getSegmentedAnalytics(templateId, userId);

        expect(segmentedAnalytics.segments).toHaveLength(3);
        expect(segmentedAnalytics.segments[0].level).toBe('senior');
        expect(segmentedAnalytics.segments[0].successRate).toBe(0.84); // 42/50
        expect(segmentedAnalytics.segments[1].level).toBe('manager');
        expect(segmentedAnalytics.segments[1].successRate).toBe(0.773); // 58/75
        expect(segmentedAnalytics.segments[2].level).toBe('junior');
        expect(segmentedAnalytics.segments[2].successRate).toBe(0.6); // 15/25

        expect(segmentedAnalytics.bestPerformingSegment).toBe('senior');
        expect(segmentedAnalytics.recommendations).toContain('senior');
      });
    });

    describe('Template Optimization and AI Enhancement', () => {
      it('should generate improved template versions using AI', async () => {
        const templateId = 'template-improve-1';
        const originalTemplate = {
          id: templateId,
          content: 'Hi, I would like to connect with you.',
          variables: [],
          category: 'basic',
          performance: {
            successRate: 0.45,
            avgResponseTime: 4.2
          }
        };

        mockAIService.improveTemplateContent.mockResolvedValue({
          improvedContent: 'Hi {{firstName}}, I noticed we both work in {{industry}} and share similar interests. I\'d love to connect and exchange insights!',
          improvements: [
            'Added personalization variables (firstName, industry)',
            'Included specific reason for connecting',
            'Made tone more engaging and professional',
            'Increased perceived value proposition'
          ],
          expectedPerformanceGain: 0.35, // 35% improvement expected
          variables: ['firstName', 'industry'],
          confidenceScore: 0.89
        });

        const improvedTemplate = await templateManager.improveTemplate(templateId, 'test-user');

        expect(improvedTemplate.success).toBe(true);
        expect(improvedTemplate.improvedContent).toContain('{{firstName}}');
        expect(improvedTemplate.improvedContent).toContain('{{industry}}');
        expect(improvedTemplate.improvements).toHaveLength(4);
        expect(improvedTemplate.expectedPerformanceGain).toBe(0.35);
        expect(improvedTemplate.variables).toEqual(['firstName', 'industry']);
        expect(mockAIService.improveTemplateContent).toHaveBeenCalledWith(
          originalTemplate.content,
          expect.objectContaining({
            currentPerformance: originalTemplate.performance,
            category: 'basic'
          })
        );
      });

      it('should generate A/B test variations', async () => {
        const templateId = 'template-variations-1';
        const baseTemplate = {
          content: 'Hi {{firstName}}, I\'d like to connect with you to discuss opportunities in {{industry}}.',
          variables: ['firstName', 'industry'],
          category: 'professional'
        };

        mockAIService.generateTemplateVariations.mockResolvedValue({
          variations: [
            {
              id: 'variation-1',
              content: 'Hello {{firstName}}! I noticed your expertise in {{industry}} and would love to connect.',
              changeType: 'tone_adjustment',
              description: 'More casual and enthusiastic tone',
              variables: ['firstName', 'industry']
            },
            {
              id: 'variation-2', 
              content: 'Hi {{firstName}}, your background in {{industry}} at {{company}} caught my attention. Let\'s connect!',
              changeType: 'personalization_increase',
              description: 'Added company variable for higher personalization',
              variables: ['firstName', 'industry', 'company']
            },
            {
              id: 'variation-3',
              content: 'Hi {{firstName}}, I see we both have experience in {{industry}}. I\'d appreciate connecting to share insights.',
              changeType: 'value_proposition',
              description: 'Emphasized mutual benefit and value exchange',
              variables: ['firstName', 'industry']
            }
          ],
          recommendedTestStrategy: {
            testDuration: 14, // days
            trafficSplit: [0.4, 0.2, 0.2, 0.2], // base, var1, var2, var3
            primaryMetric: 'acceptance_rate',
            secondaryMetrics: ['response_time', 'message_quality_score']
          }
        });

        const variations = await templateManager.generateABTestVariations(templateId, 'test-user');

        expect(variations.success).toBe(true);
        expect(variations.variations).toHaveLength(3);
        expect(variations.variations[0].changeType).toBe('tone_adjustment');
        expect(variations.variations[1].changeType).toBe('personalization_increase');
        expect(variations.variations[2].changeType).toBe('value_proposition');
        expect(variations.recommendedTestStrategy).toBeDefined();
        expect(variations.recommendedTestStrategy.trafficSplit).toEqual([0.4, 0.2, 0.2, 0.2]);
      });

      it('should handle A/B test result analysis', async () => {
        const testId = 'ab-test-1';
        const testDurationDays = 14;

        // Mock A/B test results
        mockRedis.hgetall.mockImplementation((key: string) => {
          if (key.includes('baseline')) {
            return Promise.resolve({
              impressions: '200',
              acceptances: '85',
              avgResponseTime: '2.1'
            });
          }
          if (key.includes('variation-1')) {
            return Promise.resolve({
              impressions: '100',
              acceptances: '48',
              avgResponseTime: '1.9'
            });
          }
          if (key.includes('variation-2')) {
            return Promise.resolve({
              impressions: '100',
              acceptances: '52',
              avgResponseTime: '2.3'
            });
          }
          if (key.includes('variation-3')) {
            return Promise.resolve({
              impressions: '100',
              acceptances: '41',
              avgResponseTime: '2.0'
            });
          }
          return Promise.resolve({});
        });

        const testResults = await templateManager.analyzeABTestResults(testId, 'test-user');

        expect(testResults.isSignificant).toBe(true);
        expect(testResults.winningVariation).toBe('variation-2');
        expect(testResults.winningVariationLift).toBeGreaterThan(0);
        expect(testResults.confidenceLevel).toBeGreaterThan(0.9);
        expect(testResults.recommendation).toContain('variation-2');
        expect(testResults.results).toHaveLength(4); // baseline + 3 variations
      });
    });
  });

  describe('AI Content Generation', () => {
    describe('Dynamic Content Generation', () => {
      it('should generate personalized connection messages', async () => {
        const generationRequest: ContentGenerationRequest = {
          type: 'connection',
          targetProfile: {
            firstName: 'Sarah',
            lastName: 'Johnson',
            title: 'Senior Data Scientist',
            company: 'TechCorp',
            industry: 'Technology',
            location: 'San Francisco',
            commonConnections: 5,
            mutualInterests: ['machine learning', 'data visualization']
          },
          userProfile: {
            firstName: 'John',
            lastName: 'Smith',
            title: 'ML Engineer',
            company: 'AI Startup',
            industry: 'Technology'
          },
          context: {
            connectionReason: 'professional_networking',
            tone: 'professional',
            maxLength: 200
          }
        };

        mockAIService.generateConnectionMessage.mockResolvedValue({
          content: 'Hi Sarah, I noticed your impressive work in data science at TechCorp. As a fellow ML engineer, I\'d love to connect and exchange insights about machine learning applications. We also have 5 mutual connections in common!',
          personalizationScore: 0.92,
          complianceScore: 0.96,
          variables: {
            firstName: 'Sarah',
            title: 'Senior Data Scientist', 
            company: 'TechCorp',
            commonConnections: '5',
            sharedInterest: 'machine learning'
          },
          reasoning: [
            'Mentioned specific role and company for personalization',
            'Highlighted mutual professional interest',
            'Referenced common connections for social proof',
            'Professional tone appropriate for LinkedIn'
          ]
        });

        const result = await templateManager.generatePersonalizedContent(generationRequest);

        expect(result.success).toBe(true);
        expect(result.content).toContain('Sarah');
        expect(result.content).toContain('TechCorp');
        expect(result.content).toContain('machine learning');
        expect(result.personalizationScore).toBe(0.92);
        expect(result.complianceScore).toBe(0.96);
        expect(result.reasoning).toHaveLength(4);
      });

      it('should generate contextual comment content', async () => {
        const commentRequest: ContentGenerationRequest = {
          type: 'comment',
          targetContent: {
            postText: 'Excited to share that our team just launched a new AI-powered analytics platform! The journey has been incredible and I\'m proud of what we\'ve built together.',
            authorName: 'Mike Chen',
            authorTitle: 'Product Manager',
            authorCompany: 'DataViz Inc',
            engagement: {
              likes: 45,
              comments: 12,
              shares: 8
            }
          },
          userProfile: {
            firstName: 'Alex',
            title: 'Software Engineer',
            industry: 'Technology'
          },
          context: {
            commentType: 'congratulatory',
            tone: 'professional_friendly',
            maxLength: 150
          }
        };

        mockAIService.generateCommentContent.mockResolvedValue({
          content: 'Congratulations Mike! This is fantastic news. AI-powered analytics is such an exciting space right now. Would love to hear more about the technical challenges you overcame during development.',
          relevanceScore: 0.89,
          complianceScore: 0.94,
          engagementPotential: 0.78,
          variables: {
            authorName: 'Mike',
            achievement: 'AI-powered analytics platform',
            industry: 'analytics'
          },
          reasoning: [
            'Congratulated the author by name',
            'Showed genuine interest in the achievement',
            'Asked a thoughtful follow-up question',
            'Demonstrated technical understanding'
          ]
        });

        const result = await templateManager.generatePersonalizedContent(commentRequest);

        expect(result.success).toBe(true);
        expect(result.content).toContain('Mike');
        expect(result.content).toContain('AI-powered analytics');
        expect(result.relevanceScore).toBe(0.89);
        expect(result.engagementPotential).toBe(0.78);
        expect(result.reasoning).toHaveLength(4);
      });

      it('should handle content generation failures gracefully', async () => {
        const failureRequest: ContentGenerationRequest = {
          type: 'connection',
          targetProfile: {
            firstName: 'Test',
            lastName: 'User'
          },
          context: {
            tone: 'professional',
            maxLength: 200
          }
        };

        // Mock AI service failure
        mockAIService.generateConnectionMessage.mockRejectedValue(
          new Error('AI service temporarily unavailable')
        );

        const result = await templateManager.generatePersonalizedContent(failureRequest);

        expect(result.success).toBe(false);
        expect(result.error).toContain('AI service');
        expect(result.fallbackContent).toBeDefined();
        expect(result.fallbackContent).toContain('Test');
      });
    });

    describe('Content Quality and Compliance', () => {
      it('should validate generated content for spam characteristics', async () => {
        const spamContent = {
          content: 'AMAZING OPPORTUNITY!!! Make $5000/month working from home! Click here NOW! Limited time offer!!!',
          type: 'connection' as const
        };

        mockSafetyMonitor.evaluateSpamRisk.mockResolvedValue({
          riskLevel: 'CRITICAL',
          shouldBlock: true,
          reasons: [
            'EXCESSIVE_CAPITALIZATION',
            'PROMOTIONAL_LANGUAGE',
            'FINANCIAL_CLAIMS',
            'URGENCY_MANIPULATION'
          ],
          score: 0.95,
          details: {
            capsRatio: 0.65,
            exclamationCount: 8,
            spamKeywords: ['AMAZING', 'Make $5000', 'LIMITED TIME'],
            sentimentAnalysis: 'overly_promotional'
          }
        });

        const validation = await templateManager.validateContentCompliance(spamContent, 'test-user');

        expect(validation.isCompliant).toBe(false);
        expect(validation.riskLevel).toBe('CRITICAL');
        expect(validation.shouldBlock).toBe(true);
        expect(validation.reasons).toHaveLength(4);
        expect(validation.score).toBe(0.95);
      });

      it('should approve high-quality professional content', async () => {
        const professionalContent = {
          content: 'Hi John, I noticed your expertise in data science and would appreciate connecting to share insights about industry trends.',
          type: 'connection' as const
        };

        mockSafetyMonitor.evaluateSpamRisk.mockResolvedValue({
          riskLevel: 'LOW',
          shouldBlock: false,
          reasons: [],
          score: 0.12,
          details: {
            capsRatio: 0.02,
            exclamationCount: 0,
            spamKeywords: [],
            sentimentAnalysis: 'professional'
          }
        });

        mockAIService.analyzeContentCompliance.mockResolvedValue({
          isCompliant: true,
          score: 0.94,
          issues: [],
          suggestions: []
        });

        const validation = await templateManager.validateContentCompliance(professionalContent, 'test-user');

        expect(validation.isCompliant).toBe(true);
        expect(validation.riskLevel).toBe('LOW');
        expect(validation.shouldBlock).toBe(false);
        expect(validation.score).toBe(0.12);
        expect(validation.complianceScore).toBe(0.94);
      });

      it('should handle edge cases in content validation', async () => {
        const edgeCases = [
          { content: '', type: 'connection' as const }, // Empty content
          { content: 'a'.repeat(1000), type: 'connection' as const }, // Too long
          { content: '🎉🎉🎉 Congrats! 🎉🎉🎉', type: 'comment' as const }, // Emoji heavy
          { content: 'Check out https://suspicious-link.com', type: 'connection' as const } // Suspicious links
        ];

        for (const testCase of edgeCases) {
          mockSafetyMonitor.evaluateSpamRisk.mockResolvedValue({
            riskLevel: 'MEDIUM',
            shouldBlock: false,
            reasons: ['EDGE_CASE_DETECTED'],
            score: 0.5
          });

          const validation = await templateManager.validateContentCompliance(testCase, 'test-user');
          
          expect(validation).toBeDefined();
          expect(validation.riskLevel).toBeDefined();
        }
      });
    });

    describe('AI Service Integration', () => {
      it('should handle AI service rate limiting', async () => {
        const rateLimitedRequest: ContentGenerationRequest = {
          type: 'connection',
          targetProfile: { firstName: 'Rate', lastName: 'Limited' },
          context: { tone: 'professional', maxLength: 200 }
        };

        // Mock rate limit error
        mockAIService.generateConnectionMessage.mockRejectedValue({
          name: 'RateLimitError',
          message: 'AI service rate limit exceeded',
          retryAfter: 60
        });

        const result = await templateManager.generatePersonalizedContent(rateLimitedRequest);

        expect(result.success).toBe(false);
        expect(result.error).toContain('rate limit');
        expect(result.retryAfter).toBe(60);
        expect(result.fallbackContent).toBeDefined();
      });

      it('should implement caching for similar requests', async () => {
        const cacheableRequest: ContentGenerationRequest = {
          type: 'connection',
          targetProfile: {
            firstName: 'Cache',
            lastName: 'Test',
            title: 'Software Engineer',
            company: 'TechCorp'
          },
          context: { tone: 'professional', maxLength: 200 }
        };

        // Mock cached response
        mockRedis.get.mockResolvedValue(JSON.stringify({
          content: 'Cached connection message for Cache Test',
          personalizationScore: 0.85,
          complianceScore: 0.92,
          timestamp: Date.now() - 30000 // 30 seconds ago
        }));

        const result = await templateManager.generatePersonalizedContent(cacheableRequest);

        expect(result.success).toBe(true);
        expect(result.content).toContain('Cached');
        expect(result.fromCache).toBe(true);
        expect(mockAIService.generateConnectionMessage).not.toHaveBeenCalled();
      });

      it('should invalidate cache for stale entries', async () => {
        const staleRequest: ContentGenerationRequest = {
          type: 'connection',
          targetProfile: { firstName: 'Stale', lastName: 'Cache' },
          context: { tone: 'professional', maxLength: 200 }
        };

        // Mock stale cached response (over 1 hour old)
        mockRedis.get.mockResolvedValue(JSON.stringify({
          content: 'Stale cached content',
          timestamp: Date.now() - 2 * 60 * 60 * 1000 // 2 hours ago
        }));

        // Mock fresh AI response
        mockAIService.generateConnectionMessage.mockResolvedValue({
          content: 'Fresh AI-generated content for Stale Cache',
          personalizationScore: 0.88,
          complianceScore: 0.95
        });

        const result = await templateManager.generatePersonalizedContent(staleRequest);

        expect(result.success).toBe(true);
        expect(result.content).toContain('Fresh AI-generated');
        expect(result.fromCache).toBe(false);
        expect(mockAIService.generateConnectionMessage).toHaveBeenCalled();
      });
    });
  });

  describe('Template Performance Optimization', () => {
    describe('Success Rate Analysis', () => {
      it('should identify high-performing template characteristics', async () => {
        const userId = 'performance-user';
        
        // Mock template performance data
        const templateData = [
          { id: 'template-1', successRate: 0.85, length: 120, variables: 3, category: 'professional' },
          { id: 'template-2', successRate: 0.92, length: 95, variables: 4, category: 'professional' },
          { id: 'template-3', successRate: 0.67, length: 180, variables: 1, category: 'casual' },
          { id: 'template-4', successRate: 0.78, length: 150, variables: 2, category: 'promotional' }
        ];

        mockRedis.keys.mockResolvedValue(templateData.map(t => `template:${t.id}`));
        mockRedis.hgetall.mockImplementation((key: string) => {
          const templateId = key.split(':')[1];
          const template = templateData.find(t => t.id === templateId);
          return Promise.resolve({
            successRate: String(template?.successRate || 0),
            length: String(template?.length || 0),
            variables: String(template?.variables || 0),
            category: template?.category || 'unknown'
          });
        });

        const analysis = await templateManager.analyzePerformancePatterns(userId);

        expect(analysis.topPerformingCharacteristics).toContain('length_under_120');
        expect(analysis.topPerformingCharacteristics).toContain('variables_3_or_more');
        expect(analysis.recommendations).toBeDefined();
        expect(analysis.averageSuccessRate).toBeGreaterThan(0.7);
      });

      it('should provide personalized optimization recommendations', async () => {
        const templateId = 'optimize-template-1';
        const userId = 'optimize-user';

        // Mock template with poor performance
        mockRedis.hgetall.mockResolvedValue({
          successRate: '0.45',
          avgResponseTime: '4.2',
          length: '220',
          variables: '1',
          lastUpdated: String(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
        });

        mockAIService.analyzeTemplatePerformance.mockResolvedValue({
          issues: [
            'Message length is 47% longer than high-performing templates',
            'Low personalization with only 1 variable',
            'Template hasn\'t been updated in 30 days'
          ],
          recommendations: [
            'Reduce message length to 120-150 characters for better engagement',
            'Add firstName and company variables for higher personalization',
            'Test different opening lines to improve response rates',
            'Consider A/B testing with shorter variations'
          ],
          expectedImprovements: {
            successRateIncrease: 0.25,
            responseTimeDecrease: 1.5
          }
        });

        const optimization = await templateManager.getOptimizationRecommendations(templateId, userId);

        expect(optimization.issues).toHaveLength(3);
        expect(optimization.recommendations).toHaveLength(4);
        expect(optimization.expectedImprovements.successRateIncrease).toBe(0.25);
        expect(optimization.priority).toBe('high'); // Due to poor performance
      });
    });

    describe('Template Ranking and Recommendations', () => {
      it('should rank templates by performance and relevance', async () => {
        const userId = 'ranking-user';
        const context = {
          targetIndustry: 'technology',
          targetLevel: 'senior',
          connectionReason: 'professional_networking'
        };

        // Mock user's templates with various performance metrics
        mockRedis.keys.mockResolvedValue([
          'template:rank-1', 'template:rank-2', 'template:rank-3'
        ]);

        mockRedis.hgetall.mockImplementation((key: string) => {
          const templateId = key.split(':')[1];
          const templates = {
            'rank-1': {
              successRate: '0.78',
              category: 'professional',
              industry: 'technology',
              level: 'senior',
              usage: '150'
            },
            'rank-2': {
              successRate: '0.85',
              category: 'professional', 
              industry: 'technology',
              level: 'manager',
              usage: '200'
            },
            'rank-3': {
              successRate: '0.92',
              category: 'casual',
              industry: 'finance',
              level: 'junior',
              usage: '75'
            }
          };
          return Promise.resolve(templates[templateId as keyof typeof templates] || {});
        });

        const rankings = await templateManager.rankTemplates(userId, context);

        expect(rankings).toHaveLength(3);
        // Should rank by relevance + performance
        expect(rankings[0].templateId).toBe('rank-2'); // Best match for tech + good performance
        expect(rankings[0].relevanceScore).toBeGreaterThan(0.8);
        expect(rankings[0].recommendationReason).toContain('technology');
      });

      it('should recommend template creation for gaps', async () => {
        const userId = 'gap-analysis-user';
        
        // Mock user has limited template variety
        mockRedis.keys.mockResolvedValue(['template:limited-1']);
        mockRedis.hgetall.mockResolvedValue({
          category: 'professional',
          industry: 'technology',
          type: 'connection'
        });

        const gaps = await templateManager.identifyTemplateGaps(userId);

        expect(gaps.missingCategories).toContain('casual');
        expect(gaps.missingIndustries).toContain('finance');
        expect(gaps.missingTypes).toContain('comment');
        expect(gaps.recommendations).toHaveLength(3);
        expect(gaps.recommendations[0].priority).toBe('high');
      });
    });
  });

  describe('Error Handling and Performance', () => {
    describe('Service Resilience', () => {
      it('should handle AI service timeouts gracefully', async () => {
        const timeoutRequest: ContentGenerationRequest = {
          type: 'connection',
          targetProfile: { firstName: 'Timeout', lastName: 'Test' },
          context: { tone: 'professional', maxLength: 200 }
        };

        // Mock AI service timeout
        mockAIService.generateConnectionMessage.mockImplementation(() => 
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout')), 100)
          )
        );

        const result = await templateManager.generatePersonalizedContent(timeoutRequest);

        expect(result.success).toBe(false);
        expect(result.error).toContain('timeout');
        expect(result.fallbackContent).toBeDefined();
        expect(result.degradedMode).toBe(true);
      });

      it('should implement circuit breaker for failing AI services', async () => {
        // Simulate multiple consecutive failures
        for (let i = 0; i < 5; i++) {
          mockAIService.generateConnectionMessage.mockRejectedValue(
            new Error('Service unavailable')
          );

          await templateManager.generatePersonalizedContent({
            type: 'connection',
            targetProfile: { firstName: `Failure${i}` },
            context: { tone: 'professional', maxLength: 200 }
          });
        }

        // Next request should be circuit-broken
        const result = await templateManager.generatePersonalizedContent({
          type: 'connection',
          targetProfile: { firstName: 'CircuitBroken' },
          context: { tone: 'professional', maxLength: 200 }
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('circuit breaker');
        expect(result.fallbackContent).toBeDefined();
        expect(mockAIService.generateConnectionMessage).toHaveBeenCalledTimes(5); // Not called for circuit-broken request
      });
    });

    describe('Data Consistency', () => {
      it('should handle corrupted template data', async () => {
        const templateId = 'corrupted-template';
        
        // Mock corrupted data in Redis
        mockRedis.hgetall.mockResolvedValue({
          content: null,
          variables: 'invalid-json',
          successRate: 'not-a-number',
          category: ''
        });

        const template = await templateManager.getTemplate(templateId, 'test-user');

        expect(template.success).toBe(false);
        expect(template.error).toContain('corrupted');
        expect(template.requiresRecovery).toBe(true);
      });

      it('should recover from Redis connection failures', async () => {
        mockRedis.ping.mockRejectedValue(new Error('Redis connection failed'));

        const healthStatus = await templateManager.getHealthStatus();

        expect(healthStatus.status).toBe('degraded');
        expect(healthStatus.services.redis.status).toBe('unhealthy');
        expect(healthStatus.capabilities.templateCreation).toBe('limited');
        expect(healthStatus.capabilities.aiGeneration).toBe('fallback_only');
      });
    });

    describe('Performance Under Load', () => {
      it('should handle concurrent template operations', async () => {
        const userId = 'concurrent-user';
        const operationCount = 100;
        const startTime = Date.now();

        // Mock successful operations
        mockAIService.generateConnectionMessage.mockResolvedValue({
          content: 'Generated content',
          personalizationScore: 0.8,
          complianceScore: 0.9
        });

        const operations = Array.from({ length: operationCount }, (_, i) => 
          templateManager.generatePersonalizedContent({
            type: 'connection',
            targetProfile: { firstName: `User${i}` },
            context: { tone: 'professional', maxLength: 200 }
          })
        );

        const results = await Promise.all(operations);
        const executionTime = Date.now() - startTime;

        expect(results).toHaveLength(operationCount);
        expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds
        
        results.forEach(result => {
          expect(result.success).toBe(true);
        });
      });

      it('should implement request queuing for AI service limits', async () => {
        const queuedRequests = Array.from({ length: 20 }, (_, i) => ({
          type: 'connection' as const,
          targetProfile: { firstName: `Queued${i}` },
          context: { tone: 'professional' as const, maxLength: 200 }
        }));

        // Mock AI service with concurrency limit
        let concurrentCalls = 0;
        mockAIService.generateConnectionMessage.mockImplementation(() => {
          concurrentCalls++;
          expect(concurrentCalls).toBeLessThanOrEqual(5); // Max 5 concurrent
          
          return new Promise(resolve => {
            setTimeout(() => {
              concurrentCalls--;
              resolve({
                content: 'Queued content',
                personalizationScore: 0.8,
                complianceScore: 0.9
              });
            }, 100);
          });
        });

        const results = await Promise.all(
          queuedRequests.map(req => templateManager.generatePersonalizedContent(req))
        );

        expect(results).toHaveLength(20);
        results.forEach(result => {
          expect(result.success).toBe(true);
        });
      });
    });
  });
});