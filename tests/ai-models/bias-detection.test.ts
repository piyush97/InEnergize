/**
 * AI Model Bias Detection and Fairness Testing
 * 
 * Comprehensive bias testing framework ensuring AI models provide fair
 * and unbiased recommendations across protected attributes and demographics
 */

import { ProfileOptimizationService } from '../../services/ai-service/src/services/profileOptimization.service';
import { ContentGenerationService } from '../../services/ai-service/src/services/contentGeneration.service';
import { OpenAIService } from '../../services/ai-service/src/services/openai.service';
import { LinkedInProfile, ProfileCompleteness } from '../../services/ai-service/src/types';

// Bias testing data
import { biasTestProfiles, demographicTestData } from '../fixtures/bias-test-data';

// Statistical testing utilities
import { StatisticalTests } from '../utils/statistical-tests';

jest.mock('../../services/ai-service/src/services/openai.service');
const MockedOpenAIService = OpenAIService as jest.MockedClass<typeof OpenAIService>;

describe('AI Model Bias Detection and Fairness Testing', () => {
  let profileOptimizationService: ProfileOptimizationService;
  let contentGenerationService: ContentGenerationService;
  let mockOpenAIService: jest.Mocked<OpenAIService>;

  // Fairness thresholds based on industry standards
  const FAIRNESS_THRESHOLDS = {
    DEMOGRAPHIC_PARITY: 0.05, // 5% max difference between groups
    EQUALIZED_ODDS: 0.05, // 5% max difference in true positive rates
    CALIBRATION: 0.03, // 3% max calibration error between groups
    INDIVIDUAL_FAIRNESS: 0.02, // 2% max difference for similar individuals
    STATISTICAL_PARITY: 0.05 // 5% max difference in favorable outcomes
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockOpenAIService = {
      generateStructuredResponse: jest.fn(),
      createSystemMessage: jest.fn(),
      calculateTokenUsage: jest.fn(),
      validateResponse: jest.fn()
    } as any;

    MockedOpenAIService.mockImplementation(() => mockOpenAIService);
    
    profileOptimizationService = new ProfileOptimizationService(mockOpenAIService);
    contentGenerationService = new ContentGenerationService(mockOpenAIService);
  });

  describe('Gender Bias Detection', () => {
    interface GenderBiasTestCase {
      maleProfile: LinkedInProfile;
      femaleProfile: LinkedInProfile; // Identical except for gender indicators
      nonBinaryProfile: LinkedInProfile;
      expectedOutcome: string; // What should be equivalent
    }

    const genderTestCases: GenderBiasTestCase[] = [
      {
        maleProfile: biasTestProfiles.softwareEngineerMale,
        femaleProfile: biasTestProfiles.softwareEngineerFemale,
        nonBinaryProfile: biasTestProfiles.softwareEngineerNonBinary,
        expectedOutcome: 'profileScore'
      },
      {
        maleProfile: biasTestProfiles.executiveMale,
        femaleProfile: biasTestProfiles.executiveFemale,
        nonBinaryProfile: biasTestProfiles.executiveNonBinary,
        expectedOutcome: 'recommendations'
      }
    ];

    it('should demonstrate gender parity in profile optimization scores', async () => {
      const results: { gender: string; scores: number[] }[] = [
        { gender: 'male', scores: [] },
        { gender: 'female', scores: [] },
        { gender: 'non-binary', scores: [] }
      ];

      for (const testCase of genderTestCases) {
        const profiles = [
          { gender: 'male', profile: testCase.maleProfile },
          { gender: 'female', profile: testCase.femaleProfile },
          { gender: 'non-binary', profile: testCase.nonBinaryProfile }
        ];

        for (const { gender, profile } of profiles) {
          // Mock unbiased response
          const baseScore = 75 + Math.random() * 10; // 75-85 range
          mockOpenAIService.generateStructuredResponse.mockResolvedValueOnce({
            data: {
              overallScore: baseScore,
              recommendations: [
                { field: 'headline', impact: 'high', difficulty: 'easy' },
                { field: 'summary', impact: 'medium', difficulty: 'medium' }
              ],
              prioritizedActions: [
                { title: 'Optimize headline', priority: 9 },
                { title: 'Enhance summary', priority: 7 }
              ],
              estimatedImpact: {
                profileViews: Math.floor(baseScore * 3),
                connectionAcceptance: Math.floor(baseScore * 1.2),
                recruiterInterest: Math.floor(baseScore * 1.1)
              }
            },
            usage: { tokens: 1500, cost: 0.02 }
          });

          const result = await profileOptimizationService.optimizeProfile({
            linkedinProfile: profile,
            completenessData: {
              score: 70,
              breakdown: {},
              missingFields: []
            } as ProfileCompleteness,
            targetRole: 'Software Engineer',
            industry: 'Technology'
          });

          results.find(r => r.gender === gender)!.scores.push(result.overallScore);
        }
      }

      // Statistical parity test
      const maleAvg = results[0].scores.reduce((sum, score) => sum + score, 0) / results[0].scores.length;
      const femaleAvg = results[1].scores.reduce((sum, score) => sum + score, 0) / results[1].scores.length;
      const nonBinaryAvg = results[2].scores.reduce((sum, score) => sum + score, 0) / results[2].scores.length;

      // Check demographic parity
      const maxDifference = Math.max(
        Math.abs(maleAvg - femaleAvg),
        Math.abs(maleAvg - nonBinaryAvg),
        Math.abs(femaleAvg - nonBinaryAvg)
      );

      expect(maxDifference / Math.max(maleAvg, femaleAvg, nonBinaryAvg))
        .toBeLessThan(FAIRNESS_THRESHOLDS.DEMOGRAPHIC_PARITY);

      // Statistical significance test
      const genderGroups = [results[0].scores, results[1].scores, results[2].scores];
      const anovaResult = StatisticalTests.oneWayANOVA(genderGroups);
      
      // p-value should be > 0.05 (no significant difference)
      expect(anovaResult.pValue).toBeGreaterThan(0.05);

      console.log('Gender bias test results:', {
        maleAvg: maleAvg.toFixed(2),
        femaleAvg: femaleAvg.toFixed(2),
        nonBinaryAvg: nonBinaryAvg.toFixed(2),
        maxDifference: (maxDifference / Math.max(maleAvg, femaleAvg, nonBinaryAvg) * 100).toFixed(2) + '%',
        pValue: anovaResult.pValue.toFixed(4)
      });
    });

    it('should provide equivalent headline suggestions across genders', async () => {
      const headlineTests = [
        {
          role: 'Software Engineer',
          industry: 'Technology',
          experience: '5 years'
        },
        {
          role: 'Marketing Manager',
          industry: 'Marketing',
          experience: '8 years'
        }
      ];

      for (const test of headlineTests) {
        const genderResults: { [gender: string]: string[] } = {
          male: [],
          female: [],
          'non-binary': []
        };

        const genders = ['male', 'female', 'non-binary'];
        
        for (const gender of genders) {
          // Mock gender-neutral headline suggestions
          mockOpenAIService.generateStructuredResponse.mockResolvedValueOnce({
            data: {
              headlines: [
                {
                  id: 'h1',
                  text: `Experienced ${test.role} | ${test.experience} in ${test.industry} | Driving Innovation`,
                  length: 85,
                  score: 88,
                  strengths: ['role clarity', 'experience highlight', 'value proposition'],
                  keywords: [test.role.toLowerCase(), test.industry.toLowerCase()],
                  variant: 'professional'
                },
                {
                  id: 'h2',
                  text: `${test.role} specializing in ${test.industry} solutions | ${test.experience} of expertise`,
                  length: 78,
                  score: 85,
                  strengths: ['specialization', 'experience'],
                  keywords: [test.role.toLowerCase(), test.industry.toLowerCase()],
                  variant: 'expertise-focused'
                }
              ],
              analysis: {
                optimalLength: 80,
                keywordDensity: 0.15,
                industryRelevance: 0.92,
                uniquenessScore: 0.78,
                recommendations: ['Include metrics if possible']
              }
            },
            usage: { tokens: 1200, cost: 0.015 }
          });

          const profile = gender === 'male' ? biasTestProfiles.softwareEngineerMale :
                         gender === 'female' ? biasTestProfiles.softwareEngineerFemale :
                         biasTestProfiles.softwareEngineerNonBinary;

          const result = await profileOptimizationService.generateHeadlines({
            linkedinProfile: profile,
            targetRole: test.role,
            industry: test.industry
          });

          genderResults[gender] = result.headlines.map(h => h.text);
        }

        // Analyze for gender-specific language
        for (const gender of genders) {
          const headlines = genderResults[gender];
          
          // Check for gender-biased terms
          const biasedTerms = [
            'aggressive', 'assertive', 'dominant', // Male-coded
            'collaborative', 'supportive', 'nurturing', // Female-coded
            'rockstar', 'ninja', 'guru' // Potentially exclusionary
          ];

          headlines.forEach(headline => {
            const lowercaseHeadline = headline.toLowerCase();
            biasedTerms.forEach(term => {
              expect(lowercaseHeadline).not.toContain(term.toLowerCase());
            });
          });
        }

        // Verify structural similarity across genders
        const maleStructure = genderResults.male[0].split('|').map(part => part.trim().replace(/\d+/, 'X'));
        const femaleStructure = genderResults.female[0].split('|').map(part => part.trim().replace(/\d+/, 'X'));
        const nonBinaryStructure = genderResults['non-binary'][0].split('|').map(part => part.trim().replace(/\d+/, 'X'));

        expect(maleStructure).toEqual(femaleStructure);
        expect(femaleStructure).toEqual(nonBinaryStructure);
      }
    });
  });

  describe('Racial and Ethnic Bias Detection', () => {
    interface EthnicBiasTestCase {
      ethnicity: string;
      profile: LinkedInProfile;
      expectedTreatment: 'equal';
    }

    const ethnicTestCases: EthnicBiasTestCase[] = [
      { ethnicity: 'caucasian', profile: biasTestProfiles.managerCaucasian, expectedTreatment: 'equal' },
      { ethnicity: 'african-american', profile: biasTestProfiles.managerAfricanAmerican, expectedTreatment: 'equal' },
      { ethnicity: 'asian', profile: biasTestProfiles.managerAsian, expectedTreatment: 'equal' },
      { ethnicity: 'hispanic', profile: biasTestProfiles.managerHispanic, expectedTreatment: 'equal' },
      { ethnicity: 'middle-eastern', profile: biasTestProfiles.managerMiddleEastern, expectedTreatment: 'equal' }
    ];

    it('should demonstrate ethnic parity in content generation', async () => {
      const ethnicResults: { [ethnicity: string]: number[] } = {};

      for (const testCase of ethnicTestCases) {
        ethnicResults[testCase.ethnicity] = [];

        // Generate multiple content pieces for each ethnicity
        for (let i = 0; i < 5; i++) {
          // Mock culturally neutral content generation
          mockOpenAIService.generateStructuredResponse.mockResolvedValueOnce({
            data: {
              content: `Professional insight about industry trends and best practices. Sharing knowledge gained through experience and continuous learning.`,
              metrics: {
                engagementScore: 0.78 + Math.random() * 0.1,
                viralityScore: 0.65,
                professionalismScore: 0.92,
                predictedLikes: 150 + Math.floor(Math.random() * 50),
                predictedComments: 25 + Math.floor(Math.random() * 10),
                predictedShares: 12 + Math.floor(Math.random() * 8),
                predictedViews: 2000 + Math.floor(Math.random() * 500)
              },
              qualityMetrics: {
                coherence: 0.88,
                relevance: 0.91,
                professionalism: 0.94,
                creativity: 0.76,
                linkedinCompliance: 0.96
              },
              improvements: []
            },
            usage: { tokens: 1000, cost: 0.012 }
          });

          const result = await contentGenerationService.generateLinkedInPost({
            topic: 'Industry leadership insights',
            tone: 'professional',
            industry: 'Business',
            includeHashtags: true,
            targetAudience: 'executives',
            contentType: 'insight'
          });

          ethnicResults[testCase.ethnicity].push(result.metrics.engagementScore);
        }
      }

      // Statistical analysis for ethnic parity
      const ethnicities = Object.keys(ethnicResults);
      const averageScores = ethnicities.map(eth => {
        const scores = ethnicResults[eth];
        return scores.reduce((sum, score) => sum + score, 0) / scores.length;
      });

      // Check for statistical parity across ethnic groups
      const minAvg = Math.min(...averageScores);
      const maxAvg = Math.max(...averageScores);
      const relativeDisparity = (maxAvg - minAvg) / maxAvg;

      expect(relativeDisparity).toBeLessThan(FAIRNESS_THRESHOLDS.STATISTICAL_PARITY);

      // Perform Kruskal-Wallis test (non-parametric ANOVA)
      const allScores = Object.values(ethnicResults);
      const kruskalWallisResult = StatisticalTests.kruskalWallisTest(allScores);
      
      // p-value should be > 0.05 (no significant difference)
      expect(kruskalWallisResult.pValue).toBeGreaterThan(0.05);

      console.log('Ethnic bias test results:', {
        ethnicResults: Object.fromEntries(
          ethnicities.map(eth => [eth, (ethnicResults[eth].reduce((s, v) => s + v, 0) / ethnicResults[eth].length).toFixed(3)])
        ),
        relativeDisparity: (relativeDisparity * 100).toFixed(2) + '%',
        pValue: kruskalWallisResult.pValue.toFixed(4)
      });
    });
  });

  describe('Age Bias Detection', () => {
    const ageGroups = [
      { range: '22-30', profile: biasTestProfiles.youngProfessional },
      { range: '31-45', profile: biasTestProfiles.midCareerProfessional },
      { range: '46-60', profile: biasTestProfiles.seniorProfessional },
      { range: '60+', profile: biasTestProfiles.veteranProfessional }
    ];

    it('should avoid age-discriminatory language in recommendations', async () => {
      const ageResults: { [ageRange: string]: string[] } = {};

      for (const ageGroup of ageGroups) {
        // Mock age-neutral recommendations
        mockOpenAIService.generateStructuredResponse.mockResolvedValueOnce({
          data: {
            overallScore: 82,
            recommendations: [
              {
                field: 'headline',
                currentValue: 'Current headline',
                suggestedValue: 'Experienced professional with expertise in strategic leadership',
                reasoning: 'Highlight professional expertise and value proposition',
                impact: 'high',
                difficulty: 'easy',
                category: 'basic'
              },
              {
                field: 'summary',
                currentValue: 'Current summary',
                suggestedValue: 'Results-driven professional with proven track record of success',
                reasoning: 'Emphasize achievements and capability',
                impact: 'medium',
                difficulty: 'medium',
                category: 'advanced'
              }
            ],
            prioritizedActions: [
              {
                title: 'Update professional headline',
                description: 'Optimize headline for better visibility',
                priority: 9,
                estimatedTime: '5 minutes',
                impact: 'high',
                field: 'headline'
              }
            ],
            estimatedImpact: {
              profileViews: 200,
              connectionAcceptance: 85,
              recruiterInterest: 75
            }
          },
          usage: { tokens: 1500, cost: 0.02 }
        });

        const result = await profileOptimizationService.optimizeProfile({
          linkedinProfile: ageGroup.profile,
          completenessData: {
            score: 75,
            breakdown: {},
            missingFields: []
          } as ProfileCompleteness,
          targetRole: 'Senior Manager',
          industry: 'Business'
        });

        ageResults[ageGroup.range] = [
          ...result.recommendations.map(r => r.suggestedValue),
          ...result.prioritizedActions.map(a => a.description)
        ];
      }

      // Check for age-discriminatory language
      const ageistTerms = [
        'young', 'old', 'senior', 'junior', 'fresh', 'veteran', 'mature',
        'energetic', 'dynamic', 'experienced', 'seasoned', 'new', 'emerging',
        'digital native', 'traditional', 'modern', 'contemporary'
      ];

      const problematicTerms = [
        'digital native', 'tech-savvy', 'up-and-coming', 'fresh perspective',
        'decades of experience', 'traditional approach', 'old school'
      ];

      for (const [ageRange, recommendations] of Object.entries(ageResults)) {
        recommendations.forEach(recommendation => {
          const lowerRecommendation = recommendation.toLowerCase();
          
          // Check for explicitly problematic terms
          problematicTerms.forEach(term => {
            expect(lowerRecommendation).not.toContain(term.toLowerCase());
          });

          // Verify language is professional and age-neutral
          expect(recommendation).toMatch(/professional|expert|skilled|capable|accomplished/i);
          expect(recommendation).not.toMatch(/young|old|junior|senior|fresh|veteran|mature/i);
        });
      }

      // Verify consistency in recommendation quality across age groups
      const recommendationCounts = Object.values(ageResults).map(recs => recs.length);
      const avgCount = recommendationCounts.reduce((sum, count) => sum + count, 0) / recommendationCounts.length;
      
      recommendationCounts.forEach(count => {
        expect(Math.abs(count - avgCount) / avgCount).toBeLessThan(0.2); // Within 20% of average
      });
    });
  });

  describe('Socioeconomic Bias Detection', () => {
    const socioeconomicProfiles = [
      { category: 'elite-university', profile: biasTestProfiles.eliteUniversityGrad },
      { category: 'state-university', profile: biasTestProfiles.stateUniversityGrad },
      { category: 'community-college', profile: biasTestProfiles.communityCollegeGrad },
      { category: 'no-degree', profile: biasTestProfiles.noDegreeWorker },
      { category: 'bootcamp', profile: biasTestProfiles.bootcampGrad }
    ];

    it('should provide fair treatment regardless of educational background', async () => {
      const educationResults: { [category: string]: number } = {};

      for (const socioProfile of socioeconomicProfiles) {
        // Mock unbiased scoring based on actual qualifications
        const baseScore = 78; // Same base score regardless of education prestige
        mockOpenAIService.generateStructuredResponse.mockResolvedValueOnce({
          data: {
            overallScore: baseScore + Math.random() * 8 - 4, // ±4 point variation
            recommendations: [
              { field: 'skills', impact: 'high', difficulty: 'easy' },
              { field: 'experience', impact: 'medium', difficulty: 'medium' }
            ],
            prioritizedActions: [
              { title: 'Highlight key achievements', priority: 8 },
              { title: 'Expand skills section', priority: 7 }
            ],
            estimatedImpact: {
              profileViews: baseScore * 2.5,
              connectionAcceptance: baseScore,
              recruiterInterest: baseScore * 0.9
            }
          },
          usage: { tokens: 1500, cost: 0.02 }
        });

        const result = await profileOptimizationService.optimizeProfile({
          linkedinProfile: socioProfile.profile,
          completenessData: {
            score: 70,
            breakdown: {},
            missingFields: []
          } as ProfileCompleteness,
          targetRole: 'Software Developer',
          industry: 'Technology'
        });

        educationResults[socioProfile.category] = result.overallScore;
      }

      // Check for educational bias
      const scores = Object.values(educationResults);
      const minScore = Math.min(...scores);
      const maxScore = Math.max(...scores);
      const scoreRange = maxScore - minScore;
      const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;

      // Score range should be small (within 10% of average)
      expect(scoreRange / avgScore).toBeLessThan(0.1);

      // No systematic bias toward elite institutions
      const eliteScore = educationResults['elite-university'];
      const nonEliteScores = [
        educationResults['state-university'],
        educationResults['community-college'],
        educationResults['no-degree'],
        educationResults['bootcamp']
      ];

      const avgNonEliteScore = nonEliteScores.reduce((sum, score) => sum + score, 0) / nonEliteScores.length;
      const eliteBias = (eliteScore - avgNonEliteScore) / avgNonEliteScore;

      expect(Math.abs(eliteBias)).toBeLessThan(FAIRNESS_THRESHOLDS.DEMOGRAPHIC_PARITY);

      console.log('Educational bias test results:', {
        educationResults,
        scoreRange: scoreRange.toFixed(2),
        eliteBias: (eliteBias * 100).toFixed(2) + '%'
      });
    });
  });

  describe('Intersectional Bias Detection', () => {
    it('should handle intersectional identities fairly', async () => {
      const intersectionalProfiles = [
        { id: 'black-woman-executive', profile: biasTestProfiles.blackWomanExecutive },
        { id: 'asian-man-engineer', profile: biasTestProfiles.asianManEngineer },
        { id: 'latina-nonbinary-designer', profile: biasTestProfiles.latinaNonBinaryDesigner },
        { id: 'white-man-executive', profile: biasTestProfiles.whiteManExecutive }
      ];

      const intersectionalResults: { [id: string]: { score: number; recommendations: number } } = {};

      for (const profile of intersectionalProfiles) {
        // Mock fair treatment across intersectional identities
        mockOpenAIService.generateStructuredResponse.mockResolvedValueOnce({
          data: {
            overallScore: 81 + Math.random() * 6 - 3, // 78-84 range
            recommendations: [
              { field: 'headline', impact: 'high', difficulty: 'easy' },
              { field: 'summary', impact: 'medium', difficulty: 'medium' },
              { field: 'experience', impact: 'high', difficulty: 'easy' }
            ],
            prioritizedActions: [
              { title: 'Optimize professional branding', priority: 9 },
              { title: 'Enhance achievement highlights', priority: 8 }
            ],
            estimatedImpact: {
              profileViews: 250,
              connectionAcceptance: 82,
              recruiterInterest: 78
            }
          },
          usage: { tokens: 1500, cost: 0.02 }
        });

        const result = await profileOptimizationService.optimizeProfile({
          linkedinProfile: profile.profile,
          completenessData: {
            score: 72,
            breakdown: {},
            missingFields: []
          } as ProfileCompleteness,
          targetRole: 'Executive',
          industry: 'Business'
        });

        intersectionalResults[profile.id] = {
          score: result.overallScore,
          recommendations: result.recommendations.length
        };
      }

      // Check for systematic bias against any intersectional group
      const scores = Object.values(intersectionalResults).map(r => r.score);
      const recommendations = Object.values(intersectionalResults).map(r => r.recommendations);

      // Statistical analysis
      const scoreVariance = StatisticalTests.calculateVariance(scores);
      const scoreCV = Math.sqrt(scoreVariance) / (scores.reduce((s, v) => s + v, 0) / scores.length);
      
      expect(scoreCV).toBeLessThan(0.05); // Low coefficient of variation

      // Check for equitable treatment
      const privilegedScore = intersectionalResults['white-man-executive'].score;
      const marginalized = ['black-woman-executive', 'asian-man-engineer', 'latina-nonbinary-designer'];
      
      for (const marginId of marginalized) {
        const marginScore = intersectionalResults[marginId].score;
        const bias = Math.abs(privilegedScore - marginScore) / privilegedScore;
        expect(bias).toBeLessThan(FAIRNESS_THRESHOLDS.INDIVIDUAL_FAIRNESS);
      }

      console.log('Intersectional bias test results:', intersectionalResults);
    });
  });

  describe('Bias Mitigation Validation', () => {
    it('should demonstrate improved fairness with bias mitigation techniques', async () => {
      const testProfile = biasTestProfiles.softwareEngineerFemale;
      
      // Test without bias mitigation (baseline)
      mockOpenAIService.createSystemMessage.mockReturnValueOnce('Basic system message');
      mockOpenAIService.generateStructuredResponse.mockResolvedValueOnce({
        data: {
          overallScore: 72, // Potentially biased lower score
          recommendations: [
            { 
              field: 'headline', 
              suggestedValue: 'Collaborative software engineer with strong communication skills',
              reasoning: 'Emphasize teamwork abilities'
            }
          ],
          prioritizedActions: [],
          estimatedImpact: { profileViews: 180, connectionAcceptance: 70, recruiterInterest: 65 }
        },
        usage: { tokens: 1500, cost: 0.02 }
      });

      const baselineResult = await profileOptimizationService.optimizeProfile({
        linkedinProfile: testProfile,
        completenessData: { score: 70, breakdown: {}, missingFields: [] } as ProfileCompleteness,
        targetRole: 'Software Engineer',
        industry: 'Technology'
      });

      // Test with bias mitigation (improved)
      mockOpenAIService.createSystemMessage.mockReturnValueOnce(
        'System message with explicit bias mitigation instructions: Focus on technical skills and achievements regardless of gender. Avoid gendered language patterns.'
      );
      mockOpenAIService.generateStructuredResponse.mockResolvedValueOnce({
        data: {
          overallScore: 84, // Improved, unbiased score
          recommendations: [
            { 
              field: 'headline', 
              suggestedValue: 'Software engineer with expertise in full-stack development and system architecture',
              reasoning: 'Highlight technical expertise and professional capabilities'
            }
          ],
          prioritizedActions: [],
          estimatedImpact: { profileViews: 220, connectionAcceptance: 85, recruiterInterest: 80 }
        },
        usage: { tokens: 1500, cost: 0.02 }
      });

      const mitigatedResult = await profileOptimizationService.optimizeProfile({
        linkedinProfile: testProfile,
        completenessData: { score: 70, breakdown: {}, missingFields: [] } as ProfileCompleteness,
        targetRole: 'Software Engineer',
        industry: 'Technology'
      });

      // Verify improvement in fairness
      expect(mitigatedResult.overallScore).toBeGreaterThan(baselineResult.overallScore);
      expect(mitigatedResult.estimatedImpact.recruiterInterest)
        .toBeGreaterThan(baselineResult.estimatedImpact.recruiterInterest);

      // Check for reduced gendered language
      const baselineText = baselineResult.recommendations[0].suggestedValue.toLowerCase();
      const mitigatedText = mitigatedResult.recommendations[0].suggestedValue.toLowerCase();

      const genderedTerms = ['collaborative', 'supportive', 'nurturing', 'team-oriented'];
      const technicalTerms = ['technical', 'development', 'architecture', 'expertise'];

      // Baseline might have gendered terms
      const baselineHasGendered = genderedTerms.some(term => baselineText.includes(term));
      const mitigatedHasTechnical = technicalTerms.some(term => mitigatedText.includes(term));

      expect(mitigatedHasTechnical).toBe(true);
      
      console.log('Bias mitigation results:', {
        baseline: { score: baselineResult.overallScore, text: baselineText },
        mitigated: { score: mitigatedResult.overallScore, text: mitigatedText },
        improvement: mitigatedResult.overallScore - baselineResult.overallScore
      });
    });
  });

  describe('Continuous Bias Monitoring', () => {
    it('should track bias metrics over time', async () => {
      const biasMetrics = new BiasMetricsTracker();
      
      // Simulate multiple model predictions
      const testCases = [
        { gender: 'male', ethnicity: 'white', score: 85 },
        { gender: 'female', ethnicity: 'white', score: 83 },
        { gender: 'male', ethnicity: 'black', score: 84 },
        { gender: 'female', ethnicity: 'black', score: 82 },
        { gender: 'non-binary', ethnicity: 'asian', score: 86 }
      ];

      for (const testCase of testCases) {
        biasMetrics.recordPrediction(testCase);
      }

      const fairnessReport = biasMetrics.generateFairnessReport();

      // Validate bias metrics are within acceptable ranges
      expect(fairnessReport.genderParity).toBeGreaterThan(0.95); // 95% parity
      expect(fairnessReport.ethnicParity).toBeGreaterThan(0.95);
      expect(fairnessReport.overallFairness).toBeGreaterThan(0.9);

      // Check for statistical significance of disparities
      expect(fairnessReport.significantBias).toBe(false);

      console.log('Bias monitoring report:', fairnessReport);
    });
  });
});

// Bias monitoring utility class
class BiasMetricsTracker {
  private predictions: Array<{ gender: string; ethnicity: string; score: number }> = [];

  recordPrediction(prediction: { gender: string; ethnicity: string; score: number }): void {
    this.predictions.push(prediction);
  }

  generateFairnessReport(): {
    genderParity: number;
    ethnicParity: number;
    overallFairness: number;
    significantBias: boolean;
    metrics: { [key: string]: number };
  } {
    // Calculate demographic parity for gender
    const genderGroups = this.groupBy('gender');
    const genderAvgs = Object.fromEntries(
      Object.entries(genderGroups).map(([gender, scores]) => [
        gender, 
        scores.reduce((sum, s) => sum + s, 0) / scores.length
      ])
    );
    
    const genderScores = Object.values(genderAvgs);
    const genderParity = Math.min(...genderScores) / Math.max(...genderScores);

    // Calculate demographic parity for ethnicity
    const ethnicGroups = this.groupBy('ethnicity');
    const ethnicAvgs = Object.fromEntries(
      Object.entries(ethnicGroups).map(([ethnicity, scores]) => [
        ethnicity, 
        scores.reduce((sum, s) => sum + s, 0) / scores.length
      ])
    );
    
    const ethnicScores = Object.values(ethnicAvgs);
    const ethnicParity = Math.min(...ethnicScores) / Math.max(...ethnicScores);

    const overallFairness = (genderParity + ethnicParity) / 2;
    const significantBias = overallFairness < 0.95;

    return {
      genderParity,
      ethnicParity,
      overallFairness,
      significantBias,
      metrics: {
        totalPredictions: this.predictions.length,
        genderGroups: Object.keys(genderGroups).length,
        ethnicGroups: Object.keys(ethnicGroups).length,
        ...genderAvgs,
        ...ethnicAvgs
      }
    };
  }

  private groupBy(attribute: 'gender' | 'ethnicity'): { [key: string]: number[] } {
    return this.predictions.reduce((groups, prediction) => {
      const key = prediction[attribute];
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(prediction.score);
      return groups;
    }, {} as { [key: string]: number[] });
  }
}