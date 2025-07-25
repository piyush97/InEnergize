// Profile Completeness Service Unit Tests

import { ProfileCompletenessService } from '../../services/completeness.service';
import { LinkedInProfile } from '../../types/linkedin';

describe('ProfileCompletenessService', () => {
  let completenessService: ProfileCompletenessService;

  beforeEach(() => {
    completenessService = new ProfileCompletenessService();
  });

  describe('calculateCompleteness', () => {
    it('should return 0 for empty profile', () => {
      const emptyProfile: Partial<LinkedInProfile> = {};
      const result = completenessService.calculateCompleteness(emptyProfile as LinkedInProfile, 0);
      
      expect(result.score).toBe(0);
      expect(result.breakdown.basicInfo).toBe(0);
      expect(result.breakdown.headline).toBe(0);
      expect(result.breakdown.summary).toBe(0);
      expect(result.breakdown.experience).toBe(0);
      expect(result.breakdown.education).toBe(0);
      expect(result.breakdown.skills).toBe(0);
      expect(result.breakdown.profilePicture).toBe(0);
      expect(result.breakdown.connections).toBe(0);
    });

    it('should calculate correct score for complete profile', () => {
      const completeProfile: Partial<LinkedInProfile> = {
        id: 'linkedin-123',
        firstName: {
          localized: { 'en_US': 'John' },
          preferredLocale: { country: 'US', language: 'en' }
        },
        lastName: {
          localized: { 'en_US': 'Doe' },
          preferredLocale: { country: 'US', language: 'en' }
        },
        headline: 'Software Engineer at Tech Corp',
        summary: 'Experienced software engineer with 5 years in full-stack development...',
        location: {
          country: 'US',
          postalCode: '94102'
        },
        industry: 'Technology',
        positions: [{
          id: 'pos-1',
          title: 'Senior Software Engineer',
          company: {
            name: 'Tech Corp',
            id: 'tech-corp-123'
          },
          isCurrent: true,
          startDate: { year: 2020, month: 1 },
          description: 'Lead development of microservices architecture...',
          location: {
            name: 'San Francisco, CA',
            country: 'US'
          }
        }],
        educations: [{
          id: 'edu-1',
          schoolName: 'University of Technology',
          degree: 'Bachelor of Science',
          fieldOfStudy: 'Computer Science',
          startDate: { year: 2016 },
          endDate: { year: 2020 }
        }],
        skills: [{
          name: 'JavaScript',
          endorsementCount: 15
        }, {
          name: 'TypeScript',
          endorsementCount: 12
        }],
        profilePicture: {
          displayImage: 'urn:li:digitalmediaAsset:profile-pic',
          'displayImage~': {
            elements: [{
              identifiers: [{ identifier: 'profile-pic.jpg' }],
              data: { 'com.linkedin.digitalmedia.mediaartifact.StillImage': {} }
            }]
          }
        }
      };

      const result = completenessService.calculateCompleteness(completeProfile as LinkedInProfile, 500);
      
      expect(result.score).toBeGreaterThan(80); // High completeness score
      expect(result.breakdown.basicInfo).toBeGreaterThan(10);
      expect(result.breakdown.headline).toBeGreaterThan(10);
      expect(result.breakdown.summary).toBeGreaterThan(15);
      expect(result.breakdown.experience).toBeGreaterThan(15);
      expect(result.breakdown.education).toBeGreaterThan(5);
      expect(result.breakdown.skills).toBeGreaterThan(5);
      expect(result.breakdown.profilePicture).toBeGreaterThan(3);
      expect(result.breakdown.connections).toBeGreaterThan(3);
    });

    it('should calculate partial scores correctly', () => {
      const partialProfile: Partial<LinkedInProfile> = {
        firstName: {
          localized: { 'en_US': 'Jane' },
          preferredLocale: { country: 'US', language: 'en' }
        },
        lastName: {
          localized: { 'en_US': 'Smith' },
          preferredLocale: { country: 'US', language: 'en' }
        },
        headline: 'Marketing Professional',
        positions: [{
          id: 'pos-1',
          title: 'Marketing Manager',
          company: {
            name: 'Marketing Inc'
          },
          isCurrent: true,
          startDate: { year: 2021, month: 6 }
        }]
      };

      const result = completenessService.calculateCompleteness(partialProfile as LinkedInProfile, 100);
      
      expect(result.score).toBeGreaterThan(0);
      expect(result.score).toBeLessThan(100);
      expect(result.breakdown.basicInfo).toBeGreaterThan(0);
      expect(result.breakdown.headline).toBeGreaterThan(0);
      expect(result.breakdown.experience).toBeGreaterThan(0);
    });

    it('should provide improvement suggestions for incomplete profile', () => {
      const incompleteProfile: Partial<LinkedInProfile> = {
        firstName: {
          localized: { 'en_US': 'Bob' },
          preferredLocale: { country: 'US', language: 'en' }
        },
        lastName: {
          localized: { 'en_US': 'Johnson' },
          preferredLocale: { country: 'US', language: 'en' }
        }
      };

      const result = completenessService.calculateCompleteness(incompleteProfile as LinkedInProfile, 50);
      
      expect(result.suggestions).toContain('Write a compelling professional headline');
      expect(result.suggestions).toContain('Add a professional summary');
      expect(result.suggestions).toContain('Add your work experience');
      expect(result.suggestions).toContain('Add relevant skills');
    });

    it('should handle profiles with multiple positions', () => {
      const profileWithMultiplePositions: Partial<LinkedInProfile> = {
        firstName: {
          localized: { 'en_US': 'Alice' },
          preferredLocale: { country: 'US', language: 'en' }
        },
        lastName: {
          localized: { 'en_US': 'Cooper' },
          preferredLocale: { country: 'US', language: 'en' }
        },
        positions: [
          {
            id: 'pos-1',
            title: 'Senior Developer',
            company: { name: 'Current Corp' },
            isCurrent: true,
            startDate: { year: 2022, month: 1 }
          },
          {
            id: 'pos-2',
            title: 'Developer',
            company: { name: 'Previous Corp' },
            isCurrent: false,
            startDate: { year: 2020, month: 1 },
            endDate: { year: 2021, month: 12 }
          }
        ]
      };

      const result = completenessService.calculateCompleteness(profileWithMultiplePositions as LinkedInProfile, 300);
      
      expect(result.breakdown.experience).toBeGreaterThan(15); // Bonus for multiple positions
    });

    it('should handle profiles with certifications and languages', () => {
      const profileWithExtras: Partial<LinkedInProfile> = {
        firstName: {
          localized: { 'en_US': 'David' },
          preferredLocale: { country: 'US', language: 'en' }
        },
        lastName: {
          localized: { 'en_US': 'Wilson' },
          preferredLocale: { country: 'US', language: 'en' }
        },
        certifications: [{
          name: 'AWS Certified Solutions Architect',
          authority: 'Amazon Web Services',
          startDate: { year: 2023, month: 3 }
        }],
        languages: [{
          name: 'English',
          proficiency: 'NATIVE_OR_BILINGUAL'
        }, {
          name: 'Spanish',
          proficiency: 'PROFESSIONAL_WORKING'
        }]
      };

      const result = completenessService.calculateCompleteness(profileWithExtras as LinkedInProfile, 800);
      
      expect(result.score).toBeGreaterThan(10); // Should get bonus points
      expect(result.suggestions).not.toContain('Add certifications');
    });
  });

  describe('getRecommendations', () => {
    it('should provide prioritized recommendations', () => {
      const profile: Partial<LinkedInProfile> = {
        firstName: {
          localized: { 'en_US': 'Test' },
          preferredLocale: { country: 'US', language: 'en' }
        },
        lastName: {
          localized: { 'en_US': 'User' },
          preferredLocale: { country: 'US', language: 'en' }
        }
      };

      const recommendations = completenessService.getRecommendations(profile);
      
      expect(recommendations).toHaveLength(7);
      expect(recommendations[0].priority).toBe('high');
      expect(recommendations[0].impact).toBe(15);
    });

    it('should not recommend completed sections', () => {
      const profileWithHeadline: Partial<LinkedInProfile> = {
        firstName: {
          localized: { 'en_US': 'Test' },
          preferredLocale: { country: 'US', language: 'en' }
        },
        lastName: {
          localized: { 'en_US': 'User' },
          preferredLocale: { country: 'US', language: 'en' }
        },
        headline: 'Software Engineer'
      };

      const recommendations = completenessService.getRecommendations(profileWithHeadline);
      
      expect(recommendations.find(r => r.suggestion.includes('headline'))).toBeUndefined();
    });
  });

  describe('validateProfile', () => {
    it('should validate required fields', () => {
      const invalidProfile = {};
      
      const validation = completenessService.validateProfile(invalidProfile);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('First name is required');
      expect(validation.errors).toContain('Last name is required');
    });

    it('should validate field formats', () => {
      const profileWithInvalidEmail: Partial<LinkedInProfile> = {
        firstName: {
          localized: { 'en_US': 'Test' },
          preferredLocale: { country: 'US', language: 'en' }
        },
        lastName: {
          localized: { 'en_US': 'User' },
          preferredLocale: { country: 'US', language: 'en' }
        },
        emailAddress: 'invalid-email'
      };

      const validation = completenessService.validateProfile(profileWithInvalidEmail);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Invalid email format');
    });

    it('should pass validation for valid profile', () => {
      const validProfile: Partial<LinkedInProfile> = {
        firstName: {
          localized: { 'en_US': 'Test' },
          preferredLocale: { country: 'US', language: 'en' }
        },
        lastName: {
          localized: { 'en_US': 'User' },
          preferredLocale: { country: 'US', language: 'en' }
        },
        emailAddress: 'test@example.com'
      };

      const validation = completenessService.validateProfile(validProfile);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });
});