import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../services/ai-service/src/index';

describe('Enhanced AI Features Integration Tests', () => {
  let authToken: string;
  let proAuthToken: string;
  let enterpriseAuthToken: string;

  beforeAll(() => {
    // Create test tokens for different subscription levels
    authToken = jwt.sign(
      {
        id: 'test-user-basic',
        email: 'test@example.com',
        subscriptionLevel: 'BASIC',
        role: 'USER'
      },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    proAuthToken = jwt.sign(
      {
        id: 'test-user-pro',
        email: 'pro@example.com',
        subscriptionLevel: 'PRO',
        role: 'USER'
      },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    enterpriseAuthToken = jwt.sign(
      {
        id: 'test-user-enterprise',
        email: 'enterprise@example.com',
        subscriptionLevel: 'ENTERPRISE',
        role: 'USER'
      },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  describe('AI Health and Capabilities', () => {
    test('GET /ai/health - should return healthy status', async () => {
      const response = await request(app)
        .get('/ai/health')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          service: 'AI Service',
          status: 'healthy',
          checks: expect.any(Object)
        }
      });
    });

    test('GET /ai/capabilities - should return user capabilities', async () => {
      const response = await request(app)
        .get('/ai/capabilities')
        .set('Authorization', `Bearer ${proAuthToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          subscriptionLevel: 'PRO',
          limits: expect.any(Object),
          usage: expect.any(Object),
          availableFeatures: expect.arrayContaining([
            'automation_safety_scoring',
            'engagement_prediction',
            'content_optimization'
          ])
        }
      });
    });
  });

  describe('ML-Powered Safety Scoring', () => {
    test('POST /ai/automation-safety-score - should generate safety score for PRO user', async () => {
      const response = await request(app)
        .post('/ai/automation-safety-score')
        .set('Authorization', `Bearer ${proAuthToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          userId: 'test-user-pro',
          overallScore: expect.any(Number),
          riskLevel: expect.stringMatching(/^(LOW|MEDIUM|HIGH|CRITICAL)$/),
          safetyMetrics: {
            velocityScore: expect.any(Number),
            patternScore: expect.any(Number),
            complianceHistory: expect.any(Number),
            engagementQuality: expect.any(Number),
            connectionAcceptanceRate: expect.any(Number),
            responseConsistency: expect.any(Number)
          },
          predictedRisks: expect.any(Array),
          recommendations: expect.any(Array),
          nextEvaluation: expect.any(String)
        }
      });

      // Validate score ranges
      expect(response.body.data.overallScore).toBeGreaterThanOrEqual(0);
      expect(response.body.data.overallScore).toBeLessThanOrEqual(100);
    });

    test('POST /ai/automation-safety-score - should deny access for BASIC user', async () => {
      await request(app)
        .post('/ai/automation-safety-score')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
    });
  });

  describe('Predictive Analytics', () => {
    test('POST /ai/predict-engagement - should predict content engagement', async () => {
      const testContent = {
        content: 'Excited to share insights about the future of AI in business transformation. What are your thoughts on how AI will reshape our industry in the next 5 years?',
        contentType: 'post',
        includeOptimalTiming: true,
        includeAudienceInsights: true,
        targetAudience: 'Technology professionals'
      };

      const response = await request(app)
        .post('/ai/predict-engagement')
        .set('Authorization', `Bearer ${proAuthToken}`)
        .send(testContent)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          contentId: expect.any(String),
          contentType: 'post',
          predictedMetrics: {
            likes: {
              min: expect.any(Number),
              max: expect.any(Number),
              confidence: expect.any(Number)
            },
            comments: {
              min: expect.any(Number),
              max: expect.any(Number),
              confidence: expect.any(Number)
            },
            shares: {
              min: expect.any(Number),
              max: expect.any(Number),
              confidence: expect.any(Number)
            }
          },
          optimalTiming: {
            dayOfWeek: expect.any(String),
            hour: expect.any(Number),
            timezone: expect.any(String),
            confidenceScore: expect.any(Number)
          },
          audienceInsights: {
            targetDemographics: expect.any(Array),
            engagementPatterns: expect.any(Array),
            contentPreferences: expect.any(Array)
          },
          improvementSuggestions: expect.any(Array)
        }
      });

      // Validate prediction ranges
      expect(response.body.data.predictedMetrics.likes.min).toBeGreaterThanOrEqual(0);
      expect(response.body.data.predictedMetrics.likes.max).toBeGreaterThan(response.body.data.predictedMetrics.likes.min);
    });

    test('POST /ai/predict-engagement - should validate content type', async () => {
      const invalidContent = {
        content: 'Test content',
        contentType: 'invalid_type'
      };

      await request(app)
        .post('/ai/predict-engagement')
        .set('Authorization', `Bearer ${proAuthToken}`)
        .send(invalidContent)
        .expect(400);
    });
  });

  describe('Advanced Content Optimization', () => {
    test('POST /ai/optimize-content-advanced - should optimize content with NLP', async () => {
      const testContent = {
        content: 'I think AI is good for business. It helps companies do things better and faster. Many companies are using AI now.',
        targetAudience: 'Business executives',
        industry: 'Technology',
        contentType: 'post',
        focusKeywords: ['artificial intelligence', 'business transformation'],
        tone: 'professional',
        maxLength: 300
      };

      const response = await request(app)
        .post('/ai/optimize-content-advanced')
        .set('Authorization', `Bearer ${proAuthToken}`)
        .send(testContent)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          originalContent: testContent.content,
          optimizedContent: expect.any(String),
          improvements: {
            readabilityScore: {
              before: expect.any(Number),
              after: expect.any(Number)
            },
            engagementScore: {
              before: expect.any(Number),
              after: expect.any(Number)
            },
            seoScore: {
              before: expect.any(Number),
              after: expect.any(Number)
            },
            sentimentScore: {
              before: expect.any(Number),
              after: expect.any(Number)
            }
          },
          keywordOptimization: {
            addedKeywords: expect.any(Array),
            removedKeywords: expect.any(Array),
            keywordDensity: expect.any(Number),
            longTailKeywords: expect.any(Array)
          },
          recommendations: expect.any(Array),
          confidenceScore: expect.any(Number)
        }
      });

      // Validate optimization improved content
      expect(response.body.data.optimizedContent).not.toBe(testContent.content);
      expect(response.body.data.optimizedContent.length).toBeGreaterThan(0);
    });
  });

  describe('Computer Vision Analysis', () => {
    test('POST /ai/analyze-profile-image - should analyze profile image', async () => {
      const imageAnalysisRequest = {
        imageUrl: 'https://example.com/profile-image.jpg',
        userIndustry: 'Technology',
        includeCompetitorAnalysis: true,
        targetRole: 'Senior Software Engineer'
      };

      const response = await request(app)
        .post('/ai/analyze-profile-image')
        .set('Authorization', `Bearer ${proAuthToken}`)
        .send(imageAnalysisRequest)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          imageUrl: imageAnalysisRequest.imageUrl,
          qualityScore: expect.any(Number),
          professionalismScore: expect.any(Number),
          recommendations: expect.any(Array),
          detectedElements: {
            faceDetected: expect.any(Boolean),
            eyeContact: expect.any(Boolean),
            smile: expect.any(Boolean),
            professionalAttire: expect.any(Boolean),
            backgroundType: expect.any(String),
            lighting: expect.any(String),
            imageSharpness: expect.any(String)
          },
          improvementSuggestions: expect.any(Array),
          industryAlignment: {
            score: expect.any(Number),
            feedback: expect.any(Array),
            bestPractices: expect.any(Array)
          }
        }
      });

      // Validate score ranges
      expect(response.body.data.qualityScore).toBeGreaterThanOrEqual(0);
      expect(response.body.data.qualityScore).toBeLessThanOrEqual(100);
      expect(response.body.data.professionalismScore).toBeGreaterThanOrEqual(0);
      expect(response.body.data.professionalismScore).toBeLessThanOrEqual(100);
    });

    test('POST /ai/analyze-profile-image - should validate image URL', async () => {
      const invalidRequest = {
        imageUrl: 'not-a-valid-url'
      };

      await request(app)
        .post('/ai/analyze-profile-image')
        .set('Authorization', `Bearer ${proAuthToken}`)
        .send(invalidRequest)
        .expect(400);
    });
  });

  describe('Advanced Sentiment Analysis', () => {
    test('POST /ai/sentiment-analysis - should analyze content sentiment', async () => {
      const sentimentRequest = {
        content: 'I am absolutely thrilled to announce our new product launch! This innovative solution will revolutionize how businesses approach digital transformation. However, I must admit there are some challenges ahead.',
        includeEmotions: true,
        industryContext: 'Technology',
        targetAudience: 'Business professionals'
      };

      const response = await request(app)
        .post('/ai/sentiment-analysis')
        .set('Authorization', `Bearer ${authToken}`) // Available for BASIC users
        .send(sentimentRequest)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          overallSentiment: expect.stringMatching(/^(VERY_POSITIVE|POSITIVE|NEUTRAL|NEGATIVE|VERY_NEGATIVE)$/),
          sentimentScore: expect.any(Number),
          confidenceLevel: expect.any(Number),
          emotionalTone: {
            primary: expect.any(String),
            secondary: expect.any(Array),
            intensity: expect.any(Number)
          },
          emotions: {
            joy: expect.any(Number),
            sadness: expect.any(Number),
            anger: expect.any(Number),
            fear: expect.any(Number),
            surprise: expect.any(Number),
            disgust: expect.any(Number),
            trust: expect.any(Number),
            anticipation: expect.any(Number)
          },
          subjectivity: expect.any(Number),
          polarityDistribution: {
            positive: expect.any(Number),
            negative: expect.any(Number),
            neutral: expect.any(Number)
          },
          contextualInsights: {
            industryAlignment: expect.any(Number),
            professionalTone: expect.any(Number),
            audienceResonance: expect.any(Number)
          },
          improvementSuggestions: expect.any(Array)
        }
      });

      // Validate sentiment score range
      expect(response.body.data.sentimentScore).toBeGreaterThanOrEqual(-1);
      expect(response.body.data.sentimentScore).toBeLessThanOrEqual(1);
    });
  });

  describe('Advanced Recommendation Engine', () => {
    test('POST /ai/connection-recommendations - should generate connection recommendations', async () => {
      const recommendationRequest = {
        maxRecommendations: 5,
        industryFocus: ['Technology', 'Finance'],
        geographicPreference: ['United States', 'Canada'],
        connectionGoals: ['Professional networking', 'Knowledge sharing', 'Business opportunities']
      };

      const response = await request(app)
        .post('/ai/connection-recommendations')
        .set('Authorization', `Bearer ${proAuthToken}`)
        .send(recommendationRequest)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            userId: 'test-user-pro',
            targetProfile: {
              id: expect.any(String),
              name: expect.any(String),
              headline: expect.any(String),
              industry: expect.any(String),
              location: expect.any(String),
              mutualConnections: expect.any(Number),
              profileStrength: expect.any(Number)
            },
            recommendationScore: expect.any(Number),
            reasoning: {
              industryAlignment: expect.any(Number),
              networkSynergy: expect.any(Number),
              careerComplementarity: expect.any(Number),
              geographicRelevance: expect.any(Number),
              mutualValue: expect.any(Number)
            },
            connectionStrategy: {
              approach: expect.any(String),
              personalizedMessage: expect.any(String),
              bestTimeToConnect: {
                dayOfWeek: expect.any(String),
                timeOfDay: expect.any(String)
              },
              followUpStrategy: expect.any(Array)
            },
            riskAssessment: {
              connectionRisk: expect.stringMatching(/^(low|medium|high)$/),
              spamRisk: expect.any(Number),
              acceptanceProbability: expect.any(Number)
            },
            businessValue: {
              leadPotential: expect.any(Number),
              networkingValue: expect.any(Number),
              learningOpportunity: expect.any(Number),
              collaborationPotential: expect.any(Number)
            }
          })
        ])
      });

      // Validate recommendation scores
      response.body.data.forEach((rec: any) => {
        expect(rec.recommendationScore).toBeGreaterThanOrEqual(0);
        expect(rec.recommendationScore).toBeLessThanOrEqual(100);
      });
    });

    test('POST /ai/content-recommendations - should generate content recommendations', async () => {
      const contentRecRequest = {
        contentTypes: ['article', 'post', 'video'],
        industryFocus: 'Technology',
        targetAudience: 'Technology professionals and entrepreneurs',
        contentGoals: ['Thought leadership', 'Engagement growth', 'Lead generation']
      };

      const response = await request(app)
        .post('/ai/content-recommendations')
        .set('Authorization', `Bearer ${proAuthToken}`)
        .send(contentRecRequest)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            contentId: expect.any(String),
            contentType: expect.stringMatching(/^(article|post|video|carousel|newsletter)$/),
            topic: expect.any(String),
            suggestedContent: {
              title: expect.any(String),
              outline: expect.any(Array),
              keyPoints: expect.any(Array),
              targetLength: expect.any(Number),
              optimalFormat: expect.any(String)
            },
            audienceTargeting: {
              primaryAudience: expect.any(String),
              secondaryAudiences: expect.any(Array),
              demographicProfile: {
                industries: expect.any(Array),
                jobLevels: expect.any(Array),
                geography: expect.any(Array)
              }
            },
            performancePrediction: {
              expectedEngagement: {
                likes: { min: expect.any(Number), max: expect.any(Number) },
                comments: { min: expect.any(Number), max: expect.any(Number) },
                shares: { min: expect.any(Number), max: expect.any(Number) },
                views: { min: expect.any(Number), max: expect.any(Number) }
              },
              viralPotential: expect.any(Number),
              thoughtLeadershipImpact: expect.any(Number)
            },
            contentStrategy: {
              postingSchedule: {
                dayOfWeek: expect.any(String),
                timeOfDay: expect.any(String),
                timezone: expect.any(String)
              },
              hashtagStrategy: expect.any(Array),
              engagementStrategy: expect.any(Array)
            },
            seoOptimization: {
              primaryKeywords: expect.any(Array),
              longTailKeywords: expect.any(Array),
              searchVolume: expect.any(Number),
              competitionLevel: expect.stringMatching(/^(low|medium|high)$/)
            }
          })
        ])
      });
    });

    test('POST /ai/growth-plan - should create personalized growth plan', async () => {
      const growthPlanRequest = {
        timeframe: '90d',
        goals: {
          networkGrowth: 100,
          profileViews: 500,
          engagementRate: 8,
          thoughtLeadership: 80
        }
      };

      const response = await request(app)
        .post('/ai/growth-plan')
        .set('Authorization', `Bearer ${proAuthToken}`)
        .send(growthPlanRequest)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          userId: 'test-user-pro',
          timeframe: '90d',
          currentMetrics: {
            networkSize: expect.any(Number),
            profileViews: expect.any(Number),
            searchAppearances: expect.any(Number),
            engagementRate: expect.any(Number),
            contentPerformance: expect.any(Number)
          },
          goals: {
            networkGrowth: expect.any(Number),
            profileViewsIncrease: expect.any(Number),
            engagementImprovement: expect.any(Number),
            thoughtLeadershipScore: expect.any(Number)
          },
          actionPlan: {
            phase1: expect.any(Array),
            phase2: expect.any(Array),
            phase3: expect.any(Array)
          },
          milestones: expect.any(Array),
          riskMitigation: {
            potentialChallenges: expect.any(Array),
            mitigationStrategies: expect.any(Array),
            fallbackOptions: expect.any(Array)
          }
        }
      });

      // Validate action plan structure
      expect(response.body.data.actionPlan.phase1.length).toBeGreaterThan(0);
      expect(response.body.data.actionPlan.phase2.length).toBeGreaterThan(0);
      expect(response.body.data.actionPlan.phase3.length).toBeGreaterThan(0);
    });
  });

  describe('A/B Testing', () => {
    test('POST /ai/ab-test - should create A/B test', async () => {
      const abTestRequest = {
        testId: 'content-test-001',
        variants: [
          {
            id: 'variant-a',
            content: 'Exciting news about our AI breakthrough! This technology will transform how businesses operate.'
          },
          {
            id: 'variant-b',
            content: 'Revolutionary AI advancement announced! Our new technology is set to revolutionize business operations across industries.'
          }
        ],
        testDuration: 24,
        targetMetric: 'engagement',
        minimumSampleSize: 100,
        confidenceLevel: 0.95
      };

      const response = await request(app)
        .post('/ai/ab-test')
        .set('Authorization', `Bearer ${proAuthToken}`)
        .send(abTestRequest)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          testId: 'content-test-001',
          variants: expect.arrayContaining([
            expect.objectContaining({
              id: expect.any(String),
              content: expect.any(String),
              performance: {
                engagement: expect.any(Number),
                clicks: expect.any(Number),
                conversions: expect.any(Number),
                reach: expect.any(Number)
              },
              confidenceLevel: expect.any(Number)
            })
          ]),
          winner: expect.any(String),
          statisticalSignificance: expect.any(Number),
          recommendations: expect.any(Array),
          insights: expect.any(Array)
        }
      });

      // Validate test has exactly 2 variants
      expect(response.body.data.variants).toHaveLength(2);
    });

    test('POST /ai/ab-test - should validate minimum variants', async () => {
      const invalidTestRequest = {
        testId: 'invalid-test',
        variants: [
          { id: 'single-variant', content: 'Only one variant' }
        ]
      };

      await request(app)
        .post('/ai/ab-test')
        .set('Authorization', `Bearer ${proAuthToken}`)
        .send(invalidTestRequest)
        .expect(400);
    });
  });

  describe('Enterprise ML Features', () => {
    test('POST /ai/optimize-model - should optimize ML model for enterprise user', async () => {
      const modelOptRequest = {
        modelId: 'content-generation-model-v1',
        trainingData: [
          { input: 'sample input 1', output: 'expected output 1' },
          { input: 'sample input 2', output: 'expected output 2' }
        ],
        targetMetric: 'accuracy',
        optimizationBudget: 60,
        useAdvancedTechniques: true
      };

      const response = await request(app)
        .post('/ai/optimize-model')
        .set('Authorization', `Bearer ${enterpriseAuthToken}`)
        .send(modelOptRequest)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          originalMetrics: {
            modelId: 'content-generation-model-v1',
            accuracy: expect.any(Number),
            precision: expect.any(Number),
            recall: expect.any(Number),
            f1Score: expect.any(Number),
            responseTime: expect.any(Number),
            tokenEfficiency: expect.any(Number),
            userSatisfaction: expect.any(Number),
            businessImpact: expect.any(Number)
          },
          optimizedMetrics: {
            modelId: 'content-generation-model-v1',
            accuracy: expect.any(Number),
            precision: expect.any(Number),
            recall: expect.any(Number),
            f1Score: expect.any(Number),
            responseTime: expect.any(Number),
            tokenEfficiency: expect.any(Number),
            userSatisfaction: expect.any(Number),
            businessImpact: expect.any(Number)
          },
          improvement: {
            accuracy: expect.any(Number),
            responseTime: expect.any(Number),
            tokenEfficiency: expect.any(Number),
            cost: expect.any(Number)
          },
          recommendations: expect.any(Array),
          optimizationTechniques: expect.any(Array)
        }
      });

      // Validate improvement metrics
      expect(response.body.data.optimizedMetrics.accuracy)
        .toBeGreaterThanOrEqual(response.body.data.originalMetrics.accuracy);
    });

    test('POST /ai/optimize-model - should deny access for non-enterprise user', async () => {
      const modelOptRequest = {
        modelId: 'test-model',
        trainingData: []
      };

      await request(app)
        .post('/ai/optimize-model')
        .set('Authorization', `Bearer ${proAuthToken}`)
        .send(modelOptRequest)
        .expect(400); // ValidationError for subscription level
    });
  });

  describe('Rate Limiting and Error Handling', () => {
    test('should respect rate limits for AI endpoints', async () => {
      // This test would need to make multiple rapid requests to trigger rate limiting
      // For now, we'll just ensure the rate limiting middleware is in place
      
      const promises = Array(25).fill(null).map(() => 
        request(app)
          .post('/ai/sentiment-analysis')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ content: 'Test content for rate limiting' })
      );

      const responses = await Promise.allSettled(promises);
      
      // Some requests should be rate limited (429)
      const rateLimitedResponses = responses.filter(
        result => result.status === 'fulfilled' && (result.value as any).status === 429
      );
      
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    test('should handle invalid authentication', async () => {
      await request(app)
        .post('/ai/automation-safety-score')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    test('should handle missing required fields', async () => {
      await request(app)
        .post('/ai/predict-engagement')
        .set('Authorization', `Bearer ${proAuthToken}`)
        .send({}) // Empty body
        .expect(400);
    });
  });
});

describe('AI Service Performance and Reliability', () => {
  test('should handle concurrent requests efficiently', async () => {
    const startTime = Date.now();
    
    const concurrentRequests = Array(10).fill(null).map(() =>
      request(app)
        .post('/ai/sentiment-analysis')
        .set('Authorization', `Bearer ${jwt.sign({
          id: `test-user-${Math.random()}`,
          email: 'test@example.com',
          subscriptionLevel: 'BASIC',
          role: 'USER'
        }, process.env.JWT_SECRET || 'test-secret')}`)
        .send({
          content: 'Test content for concurrent processing',
          includeEmotions: true
        })
    );

    const responses = await Promise.all(concurrentRequests);
    const endTime = Date.now();
    
    // All requests should succeed
    responses.forEach(response => {
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
    
    // Should complete within reasonable time (5 seconds for 10 concurrent requests)
    expect(endTime - startTime).toBeLessThan(5000);
  });

  test('should provide consistent response format across all endpoints', async () => {
    const endpoints = [
      '/ai/health',
      '/ai/capabilities'
    ];

    const token = jwt.sign({
      id: 'test-consistency',
      email: 'test@example.com',
      subscriptionLevel: 'PRO',
      role: 'USER'
    }, process.env.JWT_SECRET || 'test-secret');

    for (const endpoint of endpoints) {
      const response = await request(app)
        .get(endpoint)
        .set('Authorization', `Bearer ${token}`);
      
      // All responses should have consistent structure
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('data');
      
      if (response.body.success) {
        expect(typeof response.body.success).toBe('boolean');
        expect(response.body.data).toBeDefined();
      } else {
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toHaveProperty('message');
        expect(response.body.error).toHaveProperty('code');
      }
    }
  });
});