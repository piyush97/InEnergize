import { faker } from '@faker-js/faker';

/**
 * Test data management utility for generating consistent test data
 */
export class TestDataManager {
  private static instance: TestDataManager;
  private testUsers: Map<string, TestUser> = new Map();
  private testProfiles: Map<string, LinkedInProfileData> = new Map();

  public static getInstance(): TestDataManager {
    if (!TestDataManager.instance) {
      TestDataManager.instance = new TestDataManager();
    }
    return TestDataManager.instance;
  }

  /**
   * Generate a test user with consistent data
   */
  generateTestUser(userId: string = 'default'): TestUser {
    if (this.testUsers.has(userId)) {
      return this.testUsers.get(userId)!;
    }

    const user: TestUser = {
      id: userId,
      email: faker.internet.email(),
      password: 'TestPassword123!',
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      company: faker.company.name(),
      title: faker.person.jobTitle(),
      location: faker.location.city(),
      phone: faker.phone.number(),
      createdAt: new Date().toISOString(),
    };

    this.testUsers.set(userId, user);
    return user;
  }

  /**
   * Generate LinkedIn profile test data
   */
  generateLinkedInProfile(profileId: string = 'default'): LinkedInProfileData {
    if (this.testProfiles.has(profileId)) {
      return this.testProfiles.get(profileId)!;
    }

    const profile: LinkedInProfileData = {
      id: profileId,
      linkedInId: faker.string.uuid(),
      headline: faker.person.jobTitle(),
      summary: faker.lorem.paragraphs(3),
      location: faker.location.city(),
      industry: faker.person.jobArea(),
      connections: faker.number.int({ min: 500, max: 5000 }),
      followers: faker.number.int({ min: 100, max: 10000 }),
      experience: this.generateExperience(),
      education: this.generateEducation(),
      skills: this.generateSkills(),
      completenessScore: faker.number.int({ min: 60, max: 100 }),
      profileViews: faker.number.int({ min: 50, max: 500 }),
      searchAppearances: faker.number.int({ min: 10, max: 100 }),
      postImpressions: faker.number.int({ min: 100, max: 10000 }),
      lastUpdated: new Date().toISOString(),
    };

    this.testProfiles.set(profileId, profile);
    return profile;
  }

  /**
   * Generate work experience data
   */
  private generateExperience(): ExperienceItem[] {
    const experienceCount = faker.number.int({ min: 2, max: 5 });
    const experiences: ExperienceItem[] = [];

    for (let i = 0; i < experienceCount; i++) {
      experiences.push({
        id: faker.string.uuid(),
        title: faker.person.jobTitle(),
        company: faker.company.name(),
        location: faker.location.city(),
        startDate: faker.date.past({ years: 5 }).toISOString(),
        endDate: i === 0 ? null : faker.date.recent().toISOString(), // Current job has no end date
        description: faker.lorem.paragraphs(2),
        skills: faker.helpers.arrayElements([
          'JavaScript', 'Python', 'React', 'Node.js', 'AWS', 'Docker',
          'Leadership', 'Project Management', 'Agile', 'Scrum'
        ], { min: 2, max: 5 }),
      });
    }

    return experiences;
  }

  /**
   * Generate education data
   */
  private generateEducation(): EducationItem[] {
    const educationCount = faker.number.int({ min: 1, max: 3 });
    const educations: EducationItem[] = [];

    for (let i = 0; i < educationCount; i++) {
      educations.push({
        id: faker.string.uuid(),
        school: faker.company.name() + ' University',
        degree: faker.helpers.arrayElement([
          'Bachelor of Science', 'Master of Science', 'Bachelor of Arts',
          'Master of Business Administration', 'PhD'
        ]),
        field: faker.helpers.arrayElement([
          'Computer Science', 'Business Administration', 'Engineering',
          'Marketing', 'Economics', 'Psychology'
        ]),
        startDate: faker.date.past({ years: 10 }).toISOString(),
        endDate: faker.date.past({ years: 2 }).toISOString(),
        description: faker.lorem.paragraph(),
      });
    }

    return educations;
  }

  /**
   * Generate skills data
   */
  private generateSkills(): SkillItem[] {
    const skillsList = [
      'JavaScript', 'Python', 'React', 'Node.js', 'AWS', 'Docker',
      'Leadership', 'Project Management', 'Agile', 'Scrum', 'SQL',
      'Machine Learning', 'Data Analysis', 'Marketing Strategy',
      'Content Creation', 'Public Speaking', 'Team Management'
    ];

    const selectedSkills = faker.helpers.arrayElements(skillsList, { min: 8, max: 15 });
    
    return selectedSkills.map(skill => ({
      id: faker.string.uuid(),
      name: skill,
      endorsements: faker.number.int({ min: 5, max: 99 }),
      category: this.categorizeSkill(skill),
    }));
  }

  /**
   * Categorize skills for better organization
   */
  private categorizeSkill(skill: string): string {
    const technical = ['JavaScript', 'Python', 'React', 'Node.js', 'AWS', 'Docker', 'SQL', 'Machine Learning'];
    const management = ['Leadership', 'Project Management', 'Team Management'];
    const methodology = ['Agile', 'Scrum'];
    const marketing = ['Marketing Strategy', 'Content Creation', 'Public Speaking'];
    const analysis = ['Data Analysis'];

    if (technical.includes(skill)) return 'Technical';
    if (management.includes(skill)) return 'Management';
    if (methodology.includes(skill)) return 'Methodology';
    if (marketing.includes(skill)) return 'Marketing';
    if (analysis.includes(skill)) return 'Analysis';
    return 'Other';
  }

  /**
   * Generate content ideas for testing
   */
  generateContentIdeas(): ContentIdea[] {
    return [
      {
        id: faker.string.uuid(),
        type: 'post',
        topic: 'Industry Insights',
        content: faker.lorem.paragraphs(2),
        hashtags: ['#technology', '#innovation', '#leadership'],
        estimatedReach: faker.number.int({ min: 100, max: 1000 }),
        bestTime: '09:00',
        engagement: faker.number.float({ min: 2.5, max: 8.5 }),
      },
      {
        id: faker.string.uuid(),
        type: 'article',
        topic: 'Career Development',
        content: faker.lorem.paragraphs(5),
        hashtags: ['#career', '#professional', '#growth'],
        estimatedReach: faker.number.int({ min: 500, max: 2000 }),
        bestTime: '14:00',
        engagement: faker.number.float({ min: 3.0, max: 9.0 }),
      },
      {
        id: faker.string.uuid(),
        type: 'video',
        topic: 'Thought Leadership',
        content: faker.lorem.paragraphs(1),
        hashtags: ['#leadership', '#thoughtleader', '#motivation'],
        estimatedReach: faker.number.int({ min: 200, max: 1500 }),
        bestTime: '16:00',
        engagement: faker.number.float({ min: 4.0, max: 12.0 }),
      },
    ];
  }

  /**
   * Generate automation settings for testing
   */
  generateAutomationSettings(): AutomationSettings {
    return {
      connections: {
        enabled: true,
        dailyLimit: faker.number.int({ min: 5, max: 15 }),
        targetAudience: ['Software Engineers', 'Product Managers', 'Entrepreneurs'],
        personalizedMessage: true,
        messageTemplate: 'Hi {firstName}, I noticed we work in similar fields. Would love to connect!',
        excludeCurrentConnections: true,
        excludeRecruiterProfiles: false,
      },
      engagement: {
        enabled: true,
        dailyLikes: faker.number.int({ min: 10, max: 30 }),
        dailyComments: faker.number.int({ min: 3, max: 8 }),
        dailyViews: faker.number.int({ min: 15, max: 25 }),
        targetHashtags: ['#technology', '#innovation', '#leadership'],
        engagementDelay: { min: 60, max: 300 }, // seconds
        commentTemplates: [
          'Great insights! Thanks for sharing.',
          'This is really valuable information.',
          'Interesting perspective on {topic}.'
        ],
      },
      safety: {
        healthScoreThreshold: 80,
        pauseOnLowScore: true,
        maxErrorRate: 0.03,
        weekendActivity: 0.3,
        activityWindow: { start: '09:00', end: '17:00' },
        randomDelays: true,
      },
    };
  }

  /**
   * Generate analytics data for testing
   */
  generateAnalyticsData(days: number = 30): AnalyticsData {
    const data: AnalyticsData = {
      profileViews: [],
      searchAppearances: [],
      postImpressions: [],
      engagement: [],
      connections: [],
      followers: [],
    };

    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      data.profileViews.push({
        date: dateStr,
        value: faker.number.int({ min: 5, max: 50 }),
      });

      data.searchAppearances.push({
        date: dateStr,
        value: faker.number.int({ min: 2, max: 20 }),
      });

      data.postImpressions.push({
        date: dateStr,
        value: faker.number.int({ min: 50, max: 1000 }),
      });

      data.engagement.push({
        date: dateStr,
        value: faker.number.float({ min: 1.5, max: 8.0 }),
      });

      data.connections.push({
        date: dateStr,
        value: faker.number.int({ min: 0, max: 10 }),
      });

      data.followers.push({
        date: dateStr,
        value: faker.number.int({ min: 0, max: 25 }),
      });
    }

    return data;
  }

  /**
   * Clean up test data
   */
  cleanup(): void {
    this.testUsers.clear();
    this.testProfiles.clear();
  }

  /**
   * Get existing test user
   */
  getTestUser(userId: string): TestUser | undefined {
    return this.testUsers.get(userId);
  }

  /**
   * Get existing LinkedIn profile
   */
  getLinkedInProfile(profileId: string): LinkedInProfileData | undefined {
    return this.testProfiles.get(profileId);
  }
}

// Type definitions for test data
export interface TestUser {
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  company: string;
  title: string;
  location: string;
  phone: string;
  createdAt: string;
}

export interface LinkedInProfileData {
  id: string;
  linkedInId: string;
  headline: string;
  summary: string;
  location: string;
  industry: string;
  connections: number;
  followers: number;
  experience: ExperienceItem[];
  education: EducationItem[];
  skills: SkillItem[];
  completenessScore: number;
  profileViews: number;
  searchAppearances: number;
  postImpressions: number;
  lastUpdated: string;
}

export interface ExperienceItem {
  id: string;
  title: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string | null;
  description: string;
  skills: string[];
}

export interface EducationItem {
  id: string;
  school: string;
  degree: string;
  field: string;
  startDate: string;
  endDate: string;
  description: string;
}

export interface SkillItem {
  id: string;
  name: string;
  endorsements: number;
  category: string;
}

export interface ContentIdea {
  id: string;
  type: 'post' | 'article' | 'video';
  topic: string;
  content: string;
  hashtags: string[];
  estimatedReach: number;
  bestTime: string;
  engagement: number;
}

export interface AutomationSettings {
  connections: {
    enabled: boolean;
    dailyLimit: number;
    targetAudience: string[];
    personalizedMessage: boolean;
    messageTemplate: string;
    excludeCurrentConnections: boolean;
    excludeRecruiterProfiles: boolean;
  };
  engagement: {
    enabled: boolean;
    dailyLikes: number;
    dailyComments: number;
    dailyViews: number;
    targetHashtags: string[];
    engagementDelay: { min: number; max: number };
    commentTemplates: string[];
  };
  safety: {
    healthScoreThreshold: number;
    pauseOnLowScore: boolean;
    maxErrorRate: number;
    weekendActivity: number;
    activityWindow: { start: string; end: string };
    randomDelays: boolean;
  };
}

export interface AnalyticsData {
  profileViews: { date: string; value: number }[];
  searchAppearances: { date: string; value: number }[];
  postImpressions: { date: string; value: number }[];
  engagement: { date: string; value: number }[];
  connections: { date: string; value: number }[];
  followers: { date: string; value: number }[];
}