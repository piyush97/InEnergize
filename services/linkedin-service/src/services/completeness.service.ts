// LinkedIn Profile Completeness Scoring Service

import {
  LinkedInProfile,
  ProfileCompleteness,
  LinkedInPosition,
  LinkedInEducation,
  LinkedInSkill
} from '../types/linkedin';

interface ScoringWeights {
  basicInfo: number; // Name, location - 15%
  headline: number; // Professional headline - 15%
  summary: number; // About section - 20%
  experience: number; // Work experience - 20%
  education: number; // Education history - 10%
  skills: number; // Skills and endorsements - 10%
  profilePicture: number; // Professional photo - 5%
  connections: number; // Network size - 5%
}

interface CompletionCriteria {
  basicInfo: {
    hasName: boolean;
    hasLocation: boolean;
    hasIndustry: boolean;
  };
  headline: {
    hasHeadline: boolean;
    headlineLength: number;
    isOptimized: boolean;
  };
  summary: {
    hasSummary: boolean;
    summaryLength: number;
    hasKeywords: boolean;
    hasCallToAction: boolean;
  };
  experience: {
    hasExperience: boolean;
    experienceCount: number;
    hasCurrentRole: boolean;
    hasDescriptions: boolean;
    averageDescriptionLength: number;
  };
  education: {
    hasEducation: boolean;
    educationCount: number;
    hasFieldOfStudy: boolean;
  };
  skills: {
    hasSkills: boolean;
    skillCount: number;
    hasEndorsements: boolean;
  };
  profilePicture: {
    hasPicture: boolean;
    isProfessional: boolean;
  };
  connections: {
    connectionCount: number;
  };
}

export class ProfileCompletenessService {
  private readonly weights: ScoringWeights = {
    basicInfo: 15,
    headline: 15,
    summary: 20,
    experience: 20,
    education: 10,
    skills: 10,
    profilePicture: 5,
    connections: 5
  };

  private readonly thresholds = {
    headline: {
      minLength: 20,
      optimalLength: 120,
      keywords: ['experienced', 'professional', 'specialist', 'expert', 'manager', 'director', 'consultant']
    },
    summary: {
      minLength: 100,
      optimalLength: 2000,
      keywordDensity: 0.02,
      callToActionKeywords: ['contact', 'connect', 'reach out', 'email', 'discuss', 'collaborate']
    },
    experience: {
      minPositions: 2,
      optimalPositions: 4,
      minDescriptionLength: 50,
      optimalDescriptionLength: 200
    },
    education: {
      minEducation: 1,
      optimalEducation: 2
    },
    skills: {
      minSkills: 5,
      optimalSkills: 15,
      minEndorsements: 1
    },
    connections: {
      basic: 50,
      good: 500,
      excellent: 1000
    }
  };

  /**
   * Calculate comprehensive profile completeness score
   */
  calculateCompleteness(
    profile: LinkedInProfile,
    connectionCount: number = 0
  ): ProfileCompleteness {
    const criteria = this.analyzeCriteria(profile, connectionCount);
    const scores = this.calculateScores(criteria);
    const suggestions = this.generateSuggestions(criteria);
    const missingFields = this.identifyMissingFields(criteria);

    const totalScore = Object.values(scores).reduce((sum, score) => sum + score, 0);

    return {
      score: Math.round(totalScore),
      breakdown: scores,
      suggestions,
      missingFields
    };
  }

  /**
   * Get profile improvement priorities
   */
  getPriorityImprovements(completeness: ProfileCompleteness): Array<{
    field: string;
    impact: number;
    difficulty: 'easy' | 'medium' | 'hard';
    timeEstimate: string;
    suggestion: string;
  }> {
    const improvements: Array<{
      field: string;
      impact: number;
      difficulty: 'easy' | 'medium' | 'hard';
      timeEstimate: string;
      suggestion: string;
    }> = [];

    // High impact, easy improvements
    if (completeness.breakdown.profilePicture < 5) {
      improvements.push({
        field: 'profilePicture',
        impact: 5,
        difficulty: 'easy' as const,
        timeEstimate: '5 minutes',
        suggestion: 'Add a professional headshot photo'
      });
    }

    if (completeness.breakdown.headline < 15) {
      improvements.push({
        field: 'headline',
        impact: 15,
        difficulty: 'easy' as const,
        timeEstimate: '10 minutes',
        suggestion: 'Write a compelling professional headline'
      });
    }

    // Medium impact improvements
    if (completeness.breakdown.summary < 20) {
      improvements.push({
        field: 'summary',
        impact: 20,
        difficulty: 'medium' as const,
        timeEstimate: '30 minutes',
        suggestion: 'Create a comprehensive professional summary'
      });
    }

    if (completeness.breakdown.skills < 10) {
      improvements.push({
        field: 'skills',
        impact: 10,
        difficulty: 'easy' as const,
        timeEstimate: '15 minutes',
        suggestion: 'Add relevant skills and seek endorsements'
      });
    }

    // High impact, harder improvements
    if (completeness.breakdown.experience < 20) {
      improvements.push({
        field: 'experience',
        impact: 20,
        difficulty: 'hard' as const,
        timeEstimate: '1-2 hours',
        suggestion: 'Add detailed work experience with accomplishments'
      });
    }

    return improvements.sort((a, b) => {
      // Sort by impact (descending) then difficulty (ascending)
      if (a.impact !== b.impact) return b.impact - a.impact;
      const difficultyOrder = { easy: 1, medium: 2, hard: 3 };
      return difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty];
    });
  }

  /**
   * Generate industry-specific completeness benchmarks
   */
  getIndustryBenchmarks(industry?: string): {
    averageScore: number;
    topPercentileScore: number;
    commonWeaknesses: string[];
    industrySpecificTips: string[];
  } {
    // Default benchmarks
    const defaultBenchmarks = {
      averageScore: 75,
      topPercentileScore: 90,
      commonWeaknesses: ['summary', 'experience descriptions', 'skills'],
      industrySpecificTips: [
        'Highlight quantifiable achievements',
        'Include industry-specific keywords',
        'Showcase relevant certifications'
      ]
    };

    // Industry-specific adjustments
    const industryBenchmarks: { [key: string]: typeof defaultBenchmarks } = {
      'Technology': {
        averageScore: 78,
        topPercentileScore: 92,
        commonWeaknesses: ['summary', 'project showcases'],
        industrySpecificTips: [
          'Highlight programming languages and technologies',
          'Include links to projects and portfolios',
          'Mention open source contributions',
          'Show continuous learning and certifications'
        ]
      },
      'Marketing': {
        averageScore: 80,
        topPercentileScore: 94,
        commonWeaknesses: ['quantified results', 'campaign examples'],
        industrySpecificTips: [
          'Include campaign metrics and ROI',
          'Showcase creative projects with results',
          'Highlight digital marketing tools expertise',
          'Include relevant certifications (Google, Facebook, etc.)'
        ]
      },
      'Finance': {
        averageScore: 76,
        topPercentileScore: 91,
        commonWeaknesses: ['summary personalization', 'soft skills'],
        industrySpecificTips: [
          'Highlight analytical and problem-solving skills',
          'Include relevant certifications (CPA, CFA, etc.)',
          'Mention compliance and regulatory experience',
          'Show quantifiable financial achievements'
        ]
      },
      'Sales': {
        averageScore: 82,
        topPercentileScore: 95,
        commonWeaknesses: ['experience descriptions', 'achievement quantification'],
        industrySpecificTips: [
          'Include specific sales numbers and percentages',
          'Highlight quota achievements and rankings',
          'Mention CRM and sales tools expertise',
          'Show relationship building and networking skills'
        ]
      }
    };

    return industryBenchmarks[industry || ''] || defaultBenchmarks;
  }

  /**
   * Analyze profile against completion criteria
   */
  private analyzeCriteria(profile: LinkedInProfile, connectionCount: number): CompletionCriteria {
    return {
      basicInfo: {
        hasName: !!(profile.firstName?.localized && profile.lastName?.localized),
        hasLocation: !!profile.location,
        hasIndustry: !!profile.industry
      },
      headline: {
        hasHeadline: !!profile.headline,
        headlineLength: profile.headline?.length || 0,
        isOptimized: this.isHeadlineOptimized(profile.headline)
      },
      summary: {
        hasSummary: !!profile.summary,
        summaryLength: profile.summary?.length || 0,
        hasKeywords: this.hasRelevantKeywords(profile.summary),
        hasCallToAction: this.hasCallToAction(profile.summary)
      },
      experience: this.analyzeExperience(profile.positions || []),
      education: this.analyzeEducation(profile.educations || []),
      skills: this.analyzeSkills(profile.skills || []),
      profilePicture: {
        hasPicture: !!profile.profilePicture,
        isProfessional: this.isProfessionalPicture(profile.profilePicture)
      },
      connections: {
        connectionCount
      }
    };
  }

  /**
   * Calculate individual section scores
   */
  private calculateScores(criteria: CompletionCriteria): ProfileCompleteness['breakdown'] {
    return {
      basicInfo: this.calculateBasicInfoScore(criteria.basicInfo),
      headline: this.calculateHeadlineScore(criteria.headline),
      summary: this.calculateSummaryScore(criteria.summary),
      experience: this.calculateExperienceScore(criteria.experience),
      education: this.calculateEducationScore(criteria.education),
      skills: this.calculateSkillsScore(criteria.skills),
      profilePicture: this.calculateProfilePictureScore(criteria.profilePicture),
      connections: this.calculateConnectionsScore(criteria.connections)
    };
  }

  private calculateBasicInfoScore(criteria: CompletionCriteria['basicInfo']): number {
    let score = 0;
    if (criteria.hasName) score += 8;
    if (criteria.hasLocation) score += 4;
    if (criteria.hasIndustry) score += 3;
    return Math.min(score, this.weights.basicInfo);
  }

  private calculateHeadlineScore(criteria: CompletionCriteria['headline']): number {
    if (!criteria.hasHeadline) return 0;
    
    let score = 8; // Base points for having a headline
    
    if (criteria.headlineLength >= this.thresholds.headline.minLength) {
      score += 4;
    }
    
    if (criteria.isOptimized) {
      score += 3;
    }
    
    return Math.min(score, this.weights.headline);
  }

  private calculateSummaryScore(criteria: CompletionCriteria['summary']): number {
    if (!criteria.hasSummary) return 0;
    
    let score = 10; // Base points for having a summary
    
    if (criteria.summaryLength >= this.thresholds.summary.minLength) {
      score += 5;
    }
    
    if (criteria.hasKeywords) {
      score += 3;
    }
    
    if (criteria.hasCallToAction) {
      score += 2;
    }
    
    return Math.min(score, this.weights.summary);
  }

  private calculateExperienceScore(criteria: CompletionCriteria['experience']): number {
    if (!criteria.hasExperience) return 0;
    
    let score = 8; // Base points for having experience
    
    if (criteria.experienceCount >= this.thresholds.experience.minPositions) {
      score += 4;
    }
    
    if (criteria.hasCurrentRole) {
      score += 3;
    }
    
    if (criteria.hasDescriptions) {
      score += 3;
    }
    
    if (criteria.averageDescriptionLength >= this.thresholds.experience.minDescriptionLength) {
      score += 2;
    }
    
    return Math.min(score, this.weights.experience);
  }

  private calculateEducationScore(criteria: CompletionCriteria['education']): number {
    if (!criteria.hasEducation) return 0;
    
    let score = 6; // Base points for having education
    
    if (criteria.educationCount >= this.thresholds.education.optimalEducation) {
      score += 2;
    }
    
    if (criteria.hasFieldOfStudy) {
      score += 2;
    }
    
    return Math.min(score, this.weights.education);
  }

  private calculateSkillsScore(criteria: CompletionCriteria['skills']): number {
    if (!criteria.hasSkills) return 0;
    
    let score = 5; // Base points for having skills
    
    if (criteria.skillCount >= this.thresholds.skills.minSkills) {
      score += 3;
    }
    
    if (criteria.hasEndorsements) {
      score += 2;
    }
    
    return Math.min(score, this.weights.skills);
  }

  private calculateProfilePictureScore(criteria: CompletionCriteria['profilePicture']): number {
    if (!criteria.hasPicture) return 0;
    
    let score = 3; // Base points for having a picture
    
    if (criteria.isProfessional) {
      score += 2;
    }
    
    return Math.min(score, this.weights.profilePicture);
  }

  private calculateConnectionsScore(criteria: CompletionCriteria['connections']): number {
    const count = criteria.connectionCount;
    
    if (count >= this.thresholds.connections.excellent) return 5;
    if (count >= this.thresholds.connections.good) return 4;
    if (count >= this.thresholds.connections.basic) return 3;
    if (count >= 10) return 2;
    if (count >= 1) return 1;
    
    return 0;
  }

  private analyzeExperience(positions: LinkedInPosition[]): CompletionCriteria['experience'] {
    const hasExperience = positions.length > 0;
    const hasCurrentRole = positions.some(pos => pos.isCurrent);
    const descriptionsWithContent = positions.filter(pos => pos.description && pos.description.length > 20);
    const hasDescriptions = descriptionsWithContent.length > 0;
    const avgDescriptionLength = descriptionsWithContent.length > 0 
      ? descriptionsWithContent.reduce((sum, pos) => sum + (pos.description?.length || 0), 0) / descriptionsWithContent.length
      : 0;

    return {
      hasExperience,
      experienceCount: positions.length,
      hasCurrentRole,
      hasDescriptions,
      averageDescriptionLength: avgDescriptionLength
    };
  }

  private analyzeEducation(educations: LinkedInEducation[]): CompletionCriteria['education'] {
    return {
      hasEducation: educations.length > 0,
      educationCount: educations.length,
      hasFieldOfStudy: educations.some(edu => !!edu.fieldOfStudy)
    };
  }

  private analyzeSkills(skills: LinkedInSkill[]): CompletionCriteria['skills'] {
    return {
      hasSkills: skills.length > 0,
      skillCount: skills.length,
      hasEndorsements: skills.some(skill => (skill.endorsementCount || 0) > 0)
    };
  }

  private isHeadlineOptimized(headline?: string): boolean {
    if (!headline) return false;
    
    const lowerHeadline = headline.toLowerCase();
    return this.thresholds.headline.keywords.some(keyword => 
      lowerHeadline.includes(keyword)
    );
  }

  private hasRelevantKeywords(summary?: string): boolean {
    if (!summary) return false;
    
    // Simple keyword density check
    const wordCount = summary.split(' ').length;
    const industryKeywords = ['experience', 'professional', 'management', 'development', 'strategy', 'leadership'];
    const keywordCount = industryKeywords.filter(keyword => 
      summary.toLowerCase().includes(keyword)
    ).length;
    
    return (keywordCount / wordCount) >= this.thresholds.summary.keywordDensity;
  }

  private hasCallToAction(summary?: string): boolean {
    if (!summary) return false;
    
    const lowerSummary = summary.toLowerCase();
    return this.thresholds.summary.callToActionKeywords.some(keyword =>
      lowerSummary.includes(keyword)
    );
  }

  private isProfessionalPicture(profilePicture?: LinkedInProfile['profilePicture']): boolean {
    // This would ideally use image analysis AI
    // For now, assume any picture is better than none
    return !!profilePicture;
  }

  private generateSuggestions(criteria: CompletionCriteria): string[] {
    const suggestions: string[] = [];

    if (!criteria.basicInfo.hasName) {
      suggestions.push('Complete your basic profile information including full name');
    }
    
    if (!criteria.basicInfo.hasLocation) {
      suggestions.push('Add your current location to help with local networking');
    }

    if (!criteria.headline.hasHeadline) {
      suggestions.push('Write a compelling professional headline that summarizes your expertise');
    } else if (criteria.headline.headlineLength < this.thresholds.headline.minLength) {
      suggestions.push('Expand your headline to better describe your professional value proposition');
    }

    if (!criteria.summary.hasSummary) {
      suggestions.push('Add a professional summary to tell your career story');
    } else if (criteria.summary.summaryLength < this.thresholds.summary.minLength) {
      suggestions.push('Expand your summary with more details about your experience and goals');
    }

    if (!criteria.experience.hasExperience) {
      suggestions.push('Add your work experience with detailed descriptions');
    } else if (!criteria.experience.hasDescriptions) {
      suggestions.push('Add descriptions to your work experience highlighting key achievements');
    }

    if (!criteria.skills.hasSkills) {
      suggestions.push('Add relevant skills to showcase your expertise');
    } else if (criteria.skills.skillCount < this.thresholds.skills.minSkills) {
      suggestions.push('Add more skills relevant to your industry and role');
    }

    if (!criteria.profilePicture.hasPicture) {
      suggestions.push('Upload a professional headshot photo');
    }

    if (criteria.connections.connectionCount < this.thresholds.connections.basic) {
      suggestions.push('Build your professional network by connecting with colleagues and industry peers');
    }

    return suggestions;
  }

  private identifyMissingFields(criteria: CompletionCriteria): string[] {
    const missing: string[] = [];

    if (!criteria.basicInfo.hasName) missing.push('Full Name');
    if (!criteria.basicInfo.hasLocation) missing.push('Location');
    if (!criteria.basicInfo.hasIndustry) missing.push('Industry');
    if (!criteria.headline.hasHeadline) missing.push('Professional Headline');
    if (!criteria.summary.hasSummary) missing.push('Professional Summary');
    if (!criteria.experience.hasExperience) missing.push('Work Experience');
    if (!criteria.education.hasEducation) missing.push('Education');
    if (!criteria.skills.hasSkills) missing.push('Skills');
    if (!criteria.profilePicture.hasPicture) missing.push('Profile Picture');

    return missing;
  }
}