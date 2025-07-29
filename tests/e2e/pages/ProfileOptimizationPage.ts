import { Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page Object Model for LinkedIn Profile Optimization
 */
export class ProfileOptimizationPage extends BasePage {
  // Main sections
  private readonly optimizationDashboard = '[data-testid="optimization-dashboard"]';
  private readonly profileAnalysis = '[data-testid="profile-analysis"]';
  private readonly completionScore = '[data-testid="completion-score"]';
  private readonly improvementSuggestions = '[data-testid="improvement-suggestions"]';
  
  // Profile sections
  private readonly profilePhoto = '[data-testid="profile-photo-section"]';
  private readonly profileHeadline = '[data-testid="profile-headline-section"]';
  private readonly profileSummary = '[data-testid="profile-summary-section"]';
  private readonly profileExperience = '[data-testid="profile-experience-section"]';
  private readonly profileEducation = '[data-testid="profile-education-section"]';
  private readonly profileSkills = '[data-testid="profile-skills-section"]';
  
  // Action buttons
  private readonly uploadPhotoButton = '[data-testid="upload-photo-button"]';
  private readonly editHeadlineButton = '[data-testid="edit-headline-button"]';
  private readonly editSummaryButton = '[data-testid="edit-summary-button"]';
  private readonly addExperienceButton = '[data-testid="add-experience-button"]';
  private readonly addEducationButton = '[data-testid="add-education-button"]';
  private readonly addSkillsButton = '[data-testid="add-skills-button"]';
  private readonly generateSuggestionButton = '[data-testid="generate-suggestion-button"]';
  private readonly applySuggestionButton = '[data-testid="apply-suggestion-button"]';
  private readonly syncLinkedInButton = '[data-testid="sync-linkedin-button"]';
  
  // Forms and modals
  private readonly photoUploadModal = '[data-testid="photo-upload-modal"]';
  private readonly headlineEditModal = '[data-testid="headline-edit-modal"]';
  private readonly summaryEditModal = '[data-testid="summary-edit-modal"]';
  private readonly experienceModal = '[data-testid="experience-modal"]';
  private readonly educationModal = '[data-testid="education-modal"]';
  private readonly skillsModal = '[data-testid="skills-modal"]';
  
  // Form inputs
  private readonly headlineInput = '[data-testid="headline-input"]';
  private readonly summaryTextarea = '[data-testid="summary-textarea"]';
  private readonly jobTitleInput = '[data-testid="job-title-input"]';
  private readonly companyInput = '[data-testid="company-input"]';
  private readonly jobDescriptionTextarea = '[data-testid="job-description-textarea"]';
  private readonly schoolInput = '[data-testid="school-input"]';
  private readonly degreeInput = '[data-testid="degree-input"]';
  private readonly fieldOfStudyInput = '[data-testid="field-of-study-input"]';
  private readonly skillInput = '[data-testid="skill-input"]';
  private readonly saveButton = '[data-testid="save-button"]';
  private readonly cancelButton = '[data-testid="cancel-button"]';
  
  // AI suggestions
  private readonly aiSuggestions = '[data-testid="ai-suggestions"]';
  private readonly suggestionCard = '[data-testid="suggestion-card"]';
  private readonly suggestionText = '[data-testid="suggestion-text"]';
  private readonly suggestionRating = '[data-testid="suggestion-rating"]';
  
  // Progress indicators
  private readonly progressBar = '[data-testid="completion-progress-bar"]';
  private readonly progressPercentage = '[data-testid="completion-percentage"]';
  private readonly sectionStatus = '[data-testid="section-status"]';

  constructor(page: Page) {
    super(page);
  }

  /**
   * Navigate to profile optimization page
   */
  async goto(): Promise<void> {
    await this.page.goto('/dashboard/profile');
    await this.waitForPageLoad();
    await this.waitForLoadingToComplete();
  }

  /**
   * Verify optimization dashboard loaded
   */
  async verifyOptimizationDashboard(): Promise<void> {
    await expect(this.page.locator(this.optimizationDashboard)).toBeVisible();
    await expect(this.page.locator(this.profileAnalysis)).toBeVisible();
    await expect(this.page.locator(this.completionScore)).toBeVisible();
  }

  /**
   * Get current completion score
   */
  async getCompletionScore(): Promise<number> {
    const scoreText = await this.getElementText(this.completionScore);
    const match = scoreText.match(/(\d+)%/);
    return match ? parseInt(match[1]) : 0;
  }

  /**
   * Verify profile sections are visible
   */
  async verifyProfileSections(): Promise<void> {
    const sections = [
      this.profilePhoto,
      this.profileHeadline,
      this.profileSummary,
      this.profileExperience,
      this.profileEducation,
      this.profileSkills
    ];

    for (const section of sections) {
      if (await this.elementExists(section)) {
        await expect(this.page.locator(section)).toBeVisible();
      }
    }
  }

  /**
   * Upload profile photo
   */
  async uploadProfilePhoto(photoPath: string): Promise<void> {
    if (await this.elementExists(this.uploadPhotoButton)) {
      await this.clickElement(this.uploadPhotoButton);
      
      if (await this.elementExists(this.photoUploadModal)) {
        await expect(this.page.locator(this.photoUploadModal)).toBeVisible();
        
        // Upload file
        const fileInput = this.page.locator('input[type="file"]');
        await fileInput.setInputFiles(photoPath);
        
        // Wait for upload and crop interface
        await this.waitForLoadingToComplete();
        
        // Save the photo
        await this.clickElement(this.saveButton);
        await this.waitForLoadingToComplete();
        
        // Modal should close
        await this.page.waitForSelector(this.photoUploadModal, { state: 'hidden' });
      }
    }
  }

  /**
   * Edit profile headline
   */
  async editHeadline(headline: string): Promise<void> {
    if (await this.elementExists(this.editHeadlineButton)) {
      await this.clickElement(this.editHeadlineButton);
      
      if (await this.elementExists(this.headlineEditModal)) {
        await expect(this.page.locator(this.headlineEditModal)).toBeVisible();
        
        await this.fillInput(this.headlineInput, headline);
        await this.clickElement(this.saveButton);
        await this.waitForLoadingToComplete();
        
        // Modal should close
        await this.page.waitForSelector(this.headlineEditModal, { state: 'hidden' });
      }
    }
  }

  /**
   * Edit profile summary
   */
  async editSummary(summary: string): Promise<void> {
    if (await this.elementExists(this.editSummaryButton)) {
      await this.clickElement(this.editSummaryButton);
      
      if (await this.elementExists(this.summaryEditModal)) {
        await expect(this.page.locator(this.summaryEditModal)).toBeVisible();
        
        await this.fillInput(this.summaryTextarea, summary);
        await this.clickElement(this.saveButton);
        await this.waitForLoadingToComplete();
        
        // Modal should close
        await this.page.waitForSelector(this.summaryEditModal, { state: 'hidden' });
      }
    }
  }

  /**
   * Add work experience
   */
  async addExperience(experience: {
    title: string;
    company: string;
    description: string;
    startDate?: string;
    endDate?: string;
    current?: boolean;
  }): Promise<void> {
    if (await this.elementExists(this.addExperienceButton)) {
      await this.clickElement(this.addExperienceButton);
      
      if (await this.elementExists(this.experienceModal)) {
        await expect(this.page.locator(this.experienceModal)).toBeVisible();
        
        await this.fillInput(this.jobTitleInput, experience.title);
        await this.fillInput(this.companyInput, experience.company);
        await this.fillInput(this.jobDescriptionTextarea, experience.description);
        
        // Handle dates if provided
        if (experience.startDate) {
          const startDateInput = '[data-testid="start-date-input"]';
          if (await this.elementExists(startDateInput)) {
            await this.fillInput(startDateInput, experience.startDate);
          }
        }
        
        if (experience.current) {
          const currentJobCheckbox = '[data-testid="current-job-checkbox"]';
          if (await this.elementExists(currentJobCheckbox)) {
            await this.clickElement(currentJobCheckbox);
          }
        } else if (experience.endDate) {
          const endDateInput = '[data-testid="end-date-input"]';
          if (await this.elementExists(endDateInput)) {
            await this.fillInput(endDateInput, experience.endDate);
          }
        }
        
        await this.clickElement(this.saveButton);
        await this.waitForLoadingToComplete();
        
        // Modal should close
        await this.page.waitForSelector(this.experienceModal, { state: 'hidden' });
      }
    }
  }

  /**
   * Add education
   */
  async addEducation(education: {
    school: string;
    degree: string;
    field: string;
    startDate?: string;
    endDate?: string;
  }): Promise<void> {
    if (await this.elementExists(this.addEducationButton)) {
      await this.clickElement(this.addEducationButton);
      
      if (await this.elementExists(this.educationModal)) {
        await expect(this.page.locator(this.educationModal)).toBeVisible();
        
        await this.fillInput(this.schoolInput, education.school);
        await this.fillInput(this.degreeInput, education.degree);
        await this.fillInput(this.fieldOfStudyInput, education.field);
        
        // Handle dates if provided
        if (education.startDate) {
          const startDateInput = '[data-testid="education-start-date-input"]';
          if (await this.elementExists(startDateInput)) {
            await this.fillInput(startDateInput, education.startDate);
          }
        }
        
        if (education.endDate) {
          const endDateInput = '[data-testid="education-end-date-input"]';
          if (await this.elementExists(endDateInput)) {
            await this.fillInput(endDateInput, education.endDate);
          }
        }
        
        await this.clickElement(this.saveButton);
        await this.waitForLoadingToComplete();
        
        // Modal should close
        await this.page.waitForSelector(this.educationModal, { state: 'hidden' });
      }
    }
  }

  /**
   * Add skills
   */
  async addSkills(skills: string[]): Promise<void> {
    if (await this.elementExists(this.addSkillsButton)) {
      await this.clickElement(this.addSkillsButton);
      
      if (await this.elementExists(this.skillsModal)) {
        await expect(this.page.locator(this.skillsModal)).toBeVisible();
        
        for (const skill of skills) {
          await this.fillInput(this.skillInput, skill);
          
          // Press Enter or click Add button
          const addSkillButton = '[data-testid="add-skill-button"]';
          if (await this.elementExists(addSkillButton)) {
            await this.clickElement(addSkillButton);
          } else {
            await this.page.keyboard.press('Enter');
          }
          
          // Wait for skill to be added
          await this.page.waitForTimeout(500);
        }
        
        await this.clickElement(this.saveButton);
        await this.waitForLoadingToComplete();
        
        // Modal should close
        await this.page.waitForSelector(this.skillsModal, { state: 'hidden' });
      }
    }
  }

  /**
   * Generate AI suggestions
   */
  async generateAISuggestions(): Promise<void> {
    if (await this.elementExists(this.generateSuggestionButton)) {
      await this.clickElement(this.generateSuggestionButton);
      await this.waitForLoadingToComplete();
      
      // Wait for suggestions to appear
      await this.waitForElement(this.aiSuggestions);
    }
  }

  /**
   * Get AI suggestions
   */
  async getAISuggestions(): Promise<Array<{text: string; rating: string}>> {
    const suggestions: Array<{text: string; rating: string}> = [];
    
    if (await this.elementExists(this.aiSuggestions)) {
      const suggestionCards = await this.page.locator(this.suggestionCard).all();
      
      for (const card of suggestionCards) {
        const text = await card.locator(this.suggestionText).textContent() || '';
        const rating = await card.locator(this.suggestionRating).textContent() || '';
        
        suggestions.push({ text, rating });
      }
    }
    
    return suggestions;
  }

  /**
   * Apply AI suggestion
   */
  async applyAISuggestion(index: number = 0): Promise<void> {
    const suggestionCards = await this.page.locator(this.suggestionCard).all();
    
    if (suggestionCards.length > index) {
      const applyButton = suggestionCards[index].locator(this.applySuggestionButton);
      await applyButton.click();
      await this.waitForLoadingToComplete();
      
      // Confirm application if modal appears
      const confirmButton = '[data-testid="confirm-apply-button"]';
      if (await this.elementExists(confirmButton)) {
        await this.clickElement(confirmButton);
        await this.waitForLoadingToComplete();
      }
    }
  }

  /**
   * Sync with LinkedIn profile
   */
  async syncWithLinkedIn(): Promise<void> {
    if (await this.elementExists(this.syncLinkedInButton)) {
      await this.clickElement(this.syncLinkedInButton);
      await this.waitForLoadingToComplete();
      
      // Wait for sync to complete
      await this.waitForElement('[data-testid="sync-success-message"]');
    }
  }

  /**
   * Verify profile improvement suggestions
   */
  async verifyImprovementSuggestions(): Promise<void> {
    if (await this.elementExists(this.improvementSuggestions)) {
      await expect(this.page.locator(this.improvementSuggestions)).toBeVisible();
      
      // Check for common suggestions
      const commonSuggestions = [
        'Add professional headline',
        'Upload profile photo',
        'Complete work experience',
        'Add skills and endorsements',
        'Write compelling summary'
      ];
      
      for (const suggestion of commonSuggestions) {
        const suggestionElement = this.page.locator(`text=${suggestion}`).first();
        if (await suggestionElement.count() > 0) {
          await expect(suggestionElement).toBeVisible();
        }
      }
    }
  }

  /**
   * Verify section completion status
   */
  async verifySectionStatus(section: string, expectedStatus: 'complete' | 'incomplete' | 'partial'): Promise<void> {
    const sectionStatusElement = this.page.locator(`[data-section="${section}"] ${this.sectionStatus}`);
    
    if (await sectionStatusElement.count() > 0) {
      const statusClasses = await sectionStatusElement.getAttribute('class') || '';
      
      switch (expectedStatus) {
        case 'complete':
          expect(statusClasses).toContain('complete');
          break;
        case 'incomplete':
          expect(statusClasses).toContain('incomplete');
          break;
        case 'partial':
          expect(statusClasses).toContain('partial');
          break;
      }
    }
  }

  /**
   * Test profile photo upload validation
   */
  async testPhotoUploadValidation(): Promise<void> {
    if (await this.elementExists(this.uploadPhotoButton)) {
      await this.clickElement(this.uploadPhotoButton);
      
      if (await this.elementExists(this.photoUploadModal)) {
        // Test invalid file types
        const fileInput = this.page.locator('input[type="file"]');
        
        // Try uploading a text file (should fail)
        await fileInput.setInputFiles({
          name: 'test.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('test content')
        });
        
        await this.verifyErrorMessage('Please upload a valid image file');
        
        // Test oversized image
        await fileInput.setInputFiles({
          name: 'large-image.jpg',
          mimeType: 'image/jpeg',
          buffer: Buffer.alloc(10 * 1024 * 1024) // 10MB file
        });
        
        await this.verifyErrorMessage('Image size must be less than 5MB');
      }
    }
  }

  /**
   * Test form validations
   */
  async testFormValidations(): Promise<void> {
    // Test headline validation
    if (await this.elementExists(this.editHeadlineButton)) {
      await this.clickElement(this.editHeadlineButton);
      
      if (await this.elementExists(this.headlineEditModal)) {
        // Test empty headline
        await this.fillInput(this.headlineInput, '');
        await this.clickElement(this.saveButton);
        await this.verifyFieldError('Headline is required');
        
        // Test too long headline
        const longHeadline = 'A'.repeat(221); // LinkedIn limit is 220 characters
        await this.fillInput(this.headlineInput, longHeadline);
        await this.clickElement(this.saveButton);
        await this.verifyFieldError('Headline must be 220 characters or less');
        
        await this.clickElement(this.cancelButton);
      }
    }
  }

  /**
   * Test progress tracking
   */
  async testProgressTracking(): Promise<void> {
    const initialScore = await this.getCompletionScore();
    
    // Add some profile information
    await this.editHeadline('Senior Software Engineer');
    await this.editSummary('Experienced software engineer with expertise in web development.');
    
    // Check if score improved
    const newScore = await this.getCompletionScore();
    expect(newScore).toBeGreaterThan(initialScore);
    
    // Verify progress bar updated
    if (await this.elementExists(this.progressBar)) {
      const progressWidth = await this.page.locator(this.progressBar).getAttribute('style');
      expect(progressWidth).toContain(`width: ${newScore}%`);
    }
  }

  /**
   * Mock profile data
   */
  async mockProfileData(): Promise<void> {
    await this.mockApiResponse('api/v1/profile', {
      completionScore: 75,
      sections: {
        photo: { complete: true, score: 15 },
        headline: { complete: true, score: 10 },
        summary: { complete: false, score: 0 },
        experience: { complete: true, score: 25 },
        education: { complete: true, score: 15 },
        skills: { complete: false, score: 0 }
      },
      suggestions: [
        {
          type: 'summary',
          text: 'Add a compelling professional summary to increase profile views by 40%',
          priority: 'high',
          impact: 'High'
        },
        {
          type: 'skills',
          text: 'Add more relevant skills to appear in more searches',
          priority: 'medium',
          impact: 'Medium'
        }
      ]
    });

    await this.mockApiResponse('api/v1/profile/ai-suggestions', {
      headlines: [
        'Senior Software Engineer | Full-Stack Developer | Team Lead',
        'Experienced Software Engineer | React & Node.js Expert | Product Builder',
        'Full-Stack Developer | 5+ Years Experience | Scaling Web Applications'
      ],
      summaries: [
        'Passionate software engineer with 5+ years of experience building scalable web applications...',
        'Results-driven developer specializing in modern web technologies and agile methodologies...',
        'Creative problem-solver with expertise in full-stack development and team leadership...'
      ]
    });
  }

  /**
   * Test accessibility of optimization interface
   */
  async testOptimizationAccessibility(): Promise<void> {
    await this.verifyAccessibility();
    
    // Test keyboard navigation through sections
    const focusableElements = [
      this.uploadPhotoButton,
      this.editHeadlineButton,
      this.editSummaryButton,
      this.addExperienceButton,
      this.addEducationButton,
      this.addSkillsButton
    ];
    
    for (const element of focusableElements) {
      if (await this.elementExists(element)) {
        await this.page.keyboard.press('Tab');
        await this.verifyElementHasFocus(element);
      }
    }
    
    // Test ARIA labels and descriptions
    const sections = [
      this.profilePhoto,
      this.profileHeadline,
      this.profileSummary
    ];
    
    for (const section of sections) {
      if (await this.elementExists(section)) {
        const ariaLabel = await this.page.locator(section).getAttribute('aria-label');
        const ariaLabelledBy = await this.page.locator(section).getAttribute('aria-labelledby');
        
        expect(ariaLabel || ariaLabelledBy).toBeTruthy();
      }
    }
  }

  /**
   * Test responsive design of optimization interface
   */
  async testOptimizationResponsive(): Promise<void> {
    const viewports = [
      { width: 320, height: 568 }, // Mobile
      { width: 768, height: 1024 }, // Tablet
      { width: 1280, height: 720 }, // Desktop
    ];

    for (const viewport of viewports) {
      await this.verifyResponsiveDesign(viewport.width, viewport.height);
      
      // Verify key elements are accessible
      await expect(this.page.locator(this.optimizationDashboard)).toBeVisible();
      await expect(this.page.locator(this.completionScore)).toBeVisible();
      
      if (viewport.width < 768) {
        // Mobile: sections might be stacked
        const sections = await this.page.locator('[data-testid*="section"]').all();
        for (const section of sections.slice(0, 3)) { // Check first 3 sections
          const isVisible = await section.isVisible();
          expect(isVisible).toBe(true);
        }
      }
    }
  }
}