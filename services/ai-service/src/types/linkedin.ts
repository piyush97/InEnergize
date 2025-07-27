// =====================================================
// LinkedIn Data Types for AI Service
// =====================================================
// Simplified LinkedIn types to avoid circular dependencies

export interface LinkedInProfile {
  id: string;
  firstName: {
    localized: { [key: string]: string };
    preferredLocale: { country: string; language: string };
  };
  lastName: {
    localized: { [key: string]: string };
    preferredLocale: { country: string; language: string };
  };
  profilePicture?: {
    displayImage: string;
    'displayImage~': {
      elements: Array<{
        identifiers: Array<{ identifier: string }>;
        data: { 'com.linkedin.digitalmedia.mediaartifact.StillImage': any };
      }>;
    };
  };
  headline?: string;
  summary?: string;
  industry?: string;
  location?: {
    country: string;
    postalCode: string;
  };
  positions?: LinkedInPosition[];
  educations?: LinkedInEducation[];
  skills?: LinkedInSkill[];
  publicProfileUrl?: string;
  emailAddress?: string;
}

export interface LinkedInPosition {
  title: string;
  companyName: string;
  description?: string;
  startDate: {
    month: number;
    year: number;
  };
  endDate?: {
    month: number;
    year: number;
  };
  current: boolean;
  location?: string;
  industry?: string;
}

export interface LinkedInEducation {
  schoolName: string;
  degree?: string;
  fieldOfStudy?: string;
  startDate?: {
    month: number;
    year: number;
  };
  endDate?: {
    month: number;
    year: number;
  };
  description?: string;
}

export interface LinkedInSkill {
  name: string;
  endorsements?: number;
}

export interface ProfileCompleteness {
  score: number; // 0-100
  breakdown: {
    basicInfo: number;
    headline: number;
    summary: number;
    experience: number;
    education: number;
    skills: number;
    profilePicture: number;
    connections: number;
  };
  suggestions: string[];
  missingFields: string[];
}

export interface LinkedInAnalytics {
  profileViews: number;
  postImpressions: number;
  searchAppearances: number;
  connectionRequests: number;
  period: {
    start: Date;
    end: Date;
  };
}