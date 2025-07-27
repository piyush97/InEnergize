// LinkedIn Profile Completeness Scoring Service

import {
  LinkedInProfile,
  ProfileCompleteness,
  LinkedInPosition,
  LinkedInEducation,
  LinkedInSkill,
  LinkedInCertification,
  LinkedInLanguage,
  LinkedInProject,
  LinkedInVolunteerExperience,
  LinkedInRecommendation
} from '../types/linkedin';

interface ScoringWeights {
  basicInfo: number; // Name, location - 12%
  headline: number; // Professional headline - 12%
  summary: number; // About section - 18%
  experience: number; // Work experience - 18%
  education: number; // Education history - 8%
  skills: number; // Skills and endorsements - 8%
  profilePicture: number; // Professional photo - 4%
  connections: number; // Network size - 4%
  // Enhanced profile elements
  certifications: number; // Professional certifications - 5%
  languages: number; // Languages spoken - 3%
  projects: number; // Projects and portfolio - 4%
  volunteerWork: number; // Volunteer experience - 2%
  recommendations: number; // Given/received recommendations - 3%
  customUrl: number; // Custom LinkedIn URL - 3%
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
  // Enhanced criteria
  certifications: {
    hasCertifications: boolean;
    certificationCount: number;
    hasRecentCertifications: boolean;
  };
  languages: {
    hasLanguages: boolean;
    languageCount: number;
    hasProficiencyLevels: boolean;
  };
  projects: {
    hasProjects: boolean;
    projectCount: number;
    hasDescriptions: boolean;
  };
  volunteerWork: {
    hasVolunteerWork: boolean;
    volunteerCount: number;
    hasDescriptions: boolean;
  };
  recommendations: {
    hasRecommendations: boolean;
    givenCount: number;
    receivedCount: number;
  };
  customUrl: {
    hasCustomUrl: boolean;
    isOptimized: boolean;
  };
}

export class ProfileCompletenessService {
  private readonly weights: ScoringWeights = {
    basicInfo: 12,
    headline: 12,
    summary: 18,
    experience: 18,
    education: 8,
    skills: 8,
    profilePicture: 4,
    connections: 4,
    // Enhanced profile elements
    certifications: 5,
    languages: 3,
    projects: 4,
    volunteerWork: 2,
    recommendations: 3,
    customUrl: 3
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
    },
    // Enhanced thresholds for new profile elements
    certifications: {
      minCertifications: 1,
      optimalCertifications: 3,
      recentThresholdMonths: 24 // Consider certifications within 2 years as recent
    },
    languages: {
      minLanguages: 1,
      optimalLanguages: 2,
      minProficiencyLevel: 'PROFESSIONAL_WORKING'
    },
    projects: {
      minProjects: 1,
      optimalProjects: 3,
      minDescriptionLength: 100
    },
    volunteerWork: {
      minVolunteerWork: 1,
      optimalVolunteerWork: 2,
      minDescriptionLength: 50
    },
    recommendations: {
      minReceived: 1,
      optimalReceived: 3,
      minGiven: 1,
      optimalGiven: 2
    },
    customUrl: {
      minLength: 5,
      profanityCheck: ['admin', 'test', '123', 'user']
    }
  };

  /**
   * Calculate score alias for backward compatibility
   */
  calculateScore(
    profile: LinkedInProfile,
    connectionCount: number = 0
  ): ProfileCompleteness {
    return this.calculateCompleteness(profile, connectionCount);
  }

  /**
   * Calculate comprehensive profile completeness score
   */
  calculateCompleteness(
    profile: LinkedInProfile,
    connectionCount: number = 0
  ): ProfileCompleteness {
    // Validate profile first
    const validationResult = this.validateProfile(profile);
    if (!validationResult.isValid) {
      return {
        score: 0,
        breakdown: {
          basicInfo: 0,
          headline: 0,
          summary: 0,
          experience: 0,
          education: 0,
          skills: 0,
          profilePicture: 0,
          connections: 0,
          certifications: 0,
          languages: 0,
          projects: 0,
          volunteerWork: 0,
          recommendations: 0,
          customUrl: 0
        },
        suggestions: [`Profile validation failed: ${validationResult.errors.join(', ')}`],
        missingFields: validationResult.errors,
        priorityImprovements: []
      };
    }

    const criteria = this.analyzeCriteria(profile, connectionCount);
    const scores = this.calculateScores(criteria);
    const suggestions = this.generateSuggestions(criteria);
    const missingFields = this.identifyMissingFields(criteria);
    
    // Calculate total score with proper weighting
    const totalScore = Object.entries(scores).reduce((sum, [key, score]) => {
      const weight = this.weights[key as keyof ScoringWeights] || 0;
      return sum + score; // Scores are already weighted internally
    }, 0);

    // Ensure score is between 0-100
    const finalScore = Math.max(0, Math.min(100, Math.round(totalScore)));

    const completenessResult: ProfileCompleteness = {
      score: finalScore,
      breakdown: scores,
      suggestions,
      missingFields,
      priorityImprovements: []
    };

    // Calculate priority improvements after we have the base result
    completenessResult.priorityImprovements = this.getPriorityImprovements(completenessResult);

    return completenessResult;
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
    // Helper function to get localized name
    const getLocalizedName = (nameObj?: { localized: { [key: string]: string } }) => {
      if (!nameObj?.localized) return '';
      const values = Object.values(nameObj.localized);
      return values.length > 0 ? values[0] : '';
    };

    const firstName = getLocalizedName(profile.firstName);
    const lastName = getLocalizedName(profile.lastName);

    return {
      basicInfo: {
        hasName: !!(firstName && lastName),
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
        connectionCount: connectionCount || profile.connectionCount || 0
      },
      // Enhanced criteria analysis
      certifications: this.analyzeCertifications(profile.certifications || []),
      languages: this.analyzeLanguages(profile.languages || []),
      projects: this.analyzeProjects(profile.projects || []),
      volunteerWork: this.analyzeVolunteerWork(profile.volunteerExperience || []),
      recommendations: this.analyzeRecommendations(profile.recommendations || []),
      customUrl: this.analyzeCustomUrl(profile.vanityName, profile.publicProfileUrl)
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
      connections: this.calculateConnectionsScore(criteria.connections),
      // Enhanced scoring
      certifications: this.calculateCertificationsScore(criteria.certifications),
      languages: this.calculateLanguagesScore(criteria.languages),
      projects: this.calculateProjectsScore(criteria.projects),
      volunteerWork: this.calculateVolunteerWorkScore(criteria.volunteerWork),
      recommendations: this.calculateRecommendationsScore(criteria.recommendations),
      customUrl: this.calculateCustomUrlScore(criteria.customUrl)
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
    if (!headline || headline.length < 10) return false;
    
    const lowerHeadline = headline.toLowerCase();
    
    // Check for action words and professional keywords
    const actionWords = ['helping', 'building', 'leading', 'creating', 'developing', 'managing', 'driving', 'transforming', 'innovating', 'optimizing'];
    const hasActionWord = actionWords.some(word => lowerHeadline.includes(word));
    
    // Check for industry keywords
    const hasIndustryKeyword = this.thresholds.headline.keywords.some(keyword => 
      lowerHeadline.includes(keyword.toLowerCase())
    );
    
    // Check for value proposition indicators
    const valueWords = ['expert', 'specialist', 'consultant', 'strategist', 'advisor', 'leader', 'professional'];
    const hasValueWord = valueWords.some(word => lowerHeadline.includes(word));
    
    // Check if it's more than just a job title
    const simpleJobTitles = ['software engineer', 'manager', 'developer', 'analyst', 'coordinator'];
    const isJustJobTitle = simpleJobTitles.some(title => 
      lowerHeadline.trim() === title || lowerHeadline.startsWith(title + ' at')
    );
    
    // A good headline should have action/value words, industry keywords, and not be just a job title
    return (hasActionWord || hasValueWord) && hasIndustryKeyword && !isJustJobTitle;
  }

  private hasRelevantKeywords(summary?: string): boolean {
    if (!summary) return false;
    
    const lowerSummary = summary.toLowerCase();
    
    // Enhanced keyword categories for better analysis
    const professionalKeywords = [
      'experience', 'professional', 'management', 'development', 'strategy', 'leadership',
      'expertise', 'skilled', 'specialist', 'results', 'achievement', 'success',
      'innovative', 'passionate', 'dedicated', 'proven', 'track record'
    ];
    
    const technicalKeywords = [
      'technology', 'software', 'data', 'analytics', 'digital', 'automation',
      'architecture', 'engineering', 'systems', 'platform', 'infrastructure',
      'cloud', 'ai', 'machine learning', 'artificial intelligence'
    ];
    
    const businessKeywords = [
      'revenue', 'growth', 'roi', 'business', 'market', 'customer', 'client',
      'sales', 'marketing', 'operations', 'finance', 'product', 'service',
      'transformation', 'optimization', 'efficiency', 'performance'
    ];
    
    const allKeywords = [...professionalKeywords, ...technicalKeywords, ...businessKeywords];
    
    // Count unique keyword matches
    const matchedKeywords = new Set();
    allKeywords.forEach(keyword => {
      if (lowerSummary.includes(keyword)) {
        matchedKeywords.add(keyword);
      }
    });
    
    // Require at least 3 different keywords for good optimization
    return matchedKeywords.size >= 3;
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
    
    // Enhanced missing fields
    if (!criteria.certifications.hasCertifications) missing.push('Professional Certifications');
    if (!criteria.languages.hasLanguages) missing.push('Languages');
    if (!criteria.projects.hasProjects) missing.push('Projects');
    if (!criteria.volunteerWork.hasVolunteerWork) missing.push('Volunteer Experience');
    if (!criteria.recommendations.hasRecommendations) missing.push('Recommendations');
    if (!criteria.customUrl.hasCustomUrl) missing.push('Custom LinkedIn URL');

    return missing;
  }

  // Enhanced analyzer methods
  private analyzeCertifications(certifications: LinkedInCertification[]): CompletionCriteria['certifications'] {
    const hasCertifications = certifications.length > 0;
    const recentCertifications = certifications.filter(cert => {
      if (!cert.startDate) return false;
      const certDate = new Date(cert.startDate.year, cert.startDate.month || 0);
      const monthsAgo = this.thresholds.certifications.recentThresholdMonths;
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - monthsAgo);
      return certDate >= cutoffDate;
    });

    return {
      hasCertifications,
      certificationCount: certifications.length,
      hasRecentCertifications: recentCertifications.length > 0
    };
  }

  private analyzeLanguages(languages: LinkedInLanguage[]): CompletionCriteria['languages'] {
    const hasLanguages = languages.length > 0;
    const proficiencyLevels = ['ELEMENTARY', 'LIMITED_WORKING', 'PROFESSIONAL_WORKING', 'FULL_PROFESSIONAL', 'NATIVE_OR_BILINGUAL'];
    const minProficiencyIndex = proficiencyLevels.indexOf(this.thresholds.languages.minProficiencyLevel);
    const hasProficiencyLevels = languages.some(lang => {
      const langIndex = proficiencyLevels.indexOf(lang.proficiency);
      return langIndex >= minProficiencyIndex;
    });

    return {
      hasLanguages,
      languageCount: languages.length,
      hasProficiencyLevels
    };
  }

  private analyzeProjects(projects: LinkedInProject[]): CompletionCriteria['projects'] {
    const hasProjects = projects.length > 0;
    const projectsWithDescriptions = projects.filter(project => 
      project.description && project.description.length >= this.thresholds.projects.minDescriptionLength
    );

    return {
      hasProjects,
      projectCount: projects.length,
      hasDescriptions: projectsWithDescriptions.length > 0
    };
  }

  private analyzeVolunteerWork(volunteerExperience: LinkedInVolunteerExperience[]): CompletionCriteria['volunteerWork'] {
    const hasVolunteerWork = volunteerExperience.length > 0;
    const volunteerWithDescriptions = volunteerExperience.filter(volunteer => 
      volunteer.description && volunteer.description.length >= this.thresholds.volunteerWork.minDescriptionLength
    );

    return {
      hasVolunteerWork,
      volunteerCount: volunteerExperience.length,
      hasDescriptions: volunteerWithDescriptions.length > 0
    };
  }

  private analyzeRecommendations(recommendations: LinkedInRecommendation[]): CompletionCriteria['recommendations'] {
    const hasRecommendations = recommendations.length > 0;
    const givenRecommendations = recommendations.filter(rec => rec.recommendationType === 'GIVEN');
    const receivedRecommendations = recommendations.filter(rec => rec.recommendationType === 'RECEIVED');

    return {
      hasRecommendations,
      givenCount: givenRecommendations.length,
      receivedCount: receivedRecommendations.length
    };
  }

  private analyzeCustomUrl(vanityName?: string, publicProfileUrl?: string): CompletionCriteria['customUrl'] {
    const hasCustomUrl = !!(vanityName || (publicProfileUrl && publicProfileUrl.includes('/in/')));
    let isOptimized = false;

    if (vanityName) {
      isOptimized = vanityName.length >= this.thresholds.customUrl.minLength &&
        !this.thresholds.customUrl.profanityCheck.some(badWord => 
          vanityName.toLowerCase().includes(badWord)
        );
    }

    return {
      hasCustomUrl,
      isOptimized
    };
  }

  // Enhanced scoring methods
  private calculateCertificationsScore(criteria: CompletionCriteria['certifications']): number {
    if (!criteria.hasCertifications) return 0;
    
    let score = 2; // Base points for having certifications
    
    if (criteria.certificationCount >= this.thresholds.certifications.minCertifications) {
      score += 2;
    }
    
    if (criteria.hasRecentCertifications) {
      score += 1;
    }
    
    return Math.min(score, this.weights.certifications);
  }

  private calculateLanguagesScore(criteria: CompletionCriteria['languages']): number {
    if (!criteria.hasLanguages) return 0;
    
    let score = 1; // Base points for having languages
    
    if (criteria.languageCount >= this.thresholds.languages.minLanguages) {
      score += 1;
    }
    
    if (criteria.hasProficiencyLevels) {
      score += 1;
    }
    
    return Math.min(score, this.weights.languages);
  }

  private calculateProjectsScore(criteria: CompletionCriteria['projects']): number {
    if (!criteria.hasProjects) return 0;
    
    let score = 2; // Base points for having projects
    
    if (criteria.projectCount >= this.thresholds.projects.minProjects) {
      score += 1;
    }
    
    if (criteria.hasDescriptions) {
      score += 1;
    }
    
    return Math.min(score, this.weights.projects);
  }

  private calculateVolunteerWorkScore(criteria: CompletionCriteria['volunteerWork']): number {
    if (!criteria.hasVolunteerWork) return 0;
    
    let score = 1; // Base points for having volunteer work
    
    if (criteria.volunteerCount >= this.thresholds.volunteerWork.minVolunteerWork) {
      score += 1;
    }
    
    return Math.min(score, this.weights.volunteerWork);
  }

  private calculateRecommendationsScore(criteria: CompletionCriteria['recommendations']): number {
    if (!criteria.hasRecommendations) return 0;
    
    let score = 1; // Base points for having recommendations
    
    if (criteria.receivedCount >= this.thresholds.recommendations.minReceived) {
      score += 1;
    }
    
    if (criteria.givenCount >= this.thresholds.recommendations.minGiven) {
      score += 1;
    }
    
    return Math.min(score, this.weights.recommendations);
  }

  private calculateCustomUrlScore(criteria: CompletionCriteria['customUrl']): number {
    if (!criteria.hasCustomUrl) return 0;
    
    let score = 1; // Base points for having custom URL
    
    if (criteria.isOptimized) {
      score += 2;
    }
    
    return Math.min(score, this.weights.customUrl);
  }

  /**
   * Get profile recommendations with priorities
   */
  getRecommendations(profile: Partial<LinkedInProfile>): Array<{
    field: string;
    priority: 'high' | 'medium' | 'low';
    impact: number;
    timeEstimate: string;
    suggestion: string;
  }> {
    const recommendations: Array<{
      field: string;
      priority: 'high' | 'medium' | 'low';
      impact: number;
      timeEstimate: string;
      suggestion: string;
    }> = [];

    // High priority recommendations
    if (!profile.headline) {
      recommendations.push({
        field: 'headline',
        priority: 'high',
        impact: 15,
        timeEstimate: '10 minutes',
        suggestion: 'Add a compelling professional headline that summarizes your expertise'
      });
    }

    if (!profile.summary) {
      recommendations.push({
        field: 'summary',
        priority: 'high',
        impact: 20,
        timeEstimate: '30 minutes',
        suggestion: 'Write a comprehensive professional summary'
      });
    }

    if (!profile.profilePicture) {
      recommendations.push({
        field: 'profilePicture',
        priority: 'high',
        impact: 5,
        timeEstimate: '5 minutes',
        suggestion: 'Upload a professional headshot photo'
      });
    }

    if (!profile.positions || profile.positions.length === 0) {
      recommendations.push({
        field: 'experience',
        priority: 'high',
        impact: 20,
        timeEstimate: '45 minutes',
        suggestion: 'Add your work experience with detailed descriptions'
      });
    }

    // Medium priority recommendations
    if (!profile.skills || profile.skills.length < 5) {
      recommendations.push({
        field: 'skills',
        priority: 'medium',
        impact: 10,
        timeEstimate: '15 minutes',
        suggestion: 'Add relevant skills to showcase your expertise'
      });
    }

    if (!profile.educations || profile.educations.length === 0) {
      recommendations.push({
        field: 'education',
        priority: 'medium',
        impact: 10,
        timeEstimate: '20 minutes',
        suggestion: 'Add your educational background'
      });
    }

    if (!profile.certifications || profile.certifications.length === 0) {
      recommendations.push({
        field: 'certifications',
        priority: 'medium',
        impact: 5,
        timeEstimate: '10 minutes',
        suggestion: 'Add relevant professional certifications'
      });
    }

    // Low priority recommendations
    if (!profile.languages || profile.languages.length === 0) {
      recommendations.push({
        field: 'languages',
        priority: 'low',
        impact: 3,
        timeEstimate: '5 minutes',
        suggestion: 'Add languages you speak'
      });
    }

    if (!profile.projects || profile.projects.length === 0) {
      recommendations.push({
        field: 'projects',
        priority: 'low',
        impact: 4,
        timeEstimate: '20 minutes',
        suggestion: 'Showcase key projects you have worked on'
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }
      return b.impact - a.impact;
    });
  }

  /**
   * Validate profile data for completeness and format
   */
  validateProfile(profile: Partial<LinkedInProfile>): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Helper function to get localized name
    const getLocalizedName = (nameObj?: { localized: { [key: string]: string } }) => {
      if (!nameObj?.localized) return '';
      const values = Object.values(nameObj.localized);
      return values.length > 0 ? values[0] : '';
    };

    // Required field validation
    const firstName = getLocalizedName(profile.firstName);
    const lastName = getLocalizedName(profile.lastName);
    
    if (!firstName) {
      errors.push('First name is required');
    }

    if (!lastName) {
      errors.push('Last name is required');
    }

    // Format validation
    if (profile.emailAddress && !this.isValidEmail(profile.emailAddress)) {
      errors.push('Invalid email format');
    }

    // Content quality validation
    if (profile.headline && profile.headline.length < 20) {
      warnings.push('Headline is too short - consider expanding it');
    }

    if (profile.summary && profile.summary.length < 100) {
      warnings.push('Summary is too short - consider adding more details');
    }

    if (profile.positions && profile.positions.length > 0) {
      const positionsWithoutDescriptions = profile.positions.filter(pos => !pos.description || pos.description.length < 50);
      if (positionsWithoutDescriptions.length > 0) {
        warnings.push('Some work experience entries lack detailed descriptions');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}