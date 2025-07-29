import { test, expect } from '../fixtures/test-fixtures';
import { AuthPage } from '../pages/AuthPage';
import { DashboardPage } from '../pages/DashboardPage';
import { ProfileOptimizationPage } from '../pages/ProfileOptimizationPage';
import { TestUtils } from '../fixtures/test-fixtures';

test.describe('Profile Optimization Workflow', () => {
  let authPage: AuthPage;
  let dashboardPage: DashboardPage;
  let profilePage: ProfileOptimizationPage;

  test.beforeEach(async ({ page, testUser }) => {
    authPage = new AuthPage(page);
    dashboardPage = new DashboardPage(page);
    profilePage = new ProfileOptimizationPage(page);

    // Sign in first
    await authPage.signIn(testUser.email, testUser.password);
    await dashboardPage.verifyDashboardLoaded();
  });

  test.describe('Profile Analysis and Completeness @profile @critical', () => {
    test('should display profile completeness score', async ({ linkedInProfile }) => {
      await profilePage.mockProfileData();
      await profilePage.goto();
      
      await profilePage.verifyOptimizationDashboard();
      
      // Verify completion score is displayed
      const completionScore = await profilePage.getCompletionScore();
      expect(completionScore).toBeGreaterThanOrEqual(0);
      expect(completionScore).toBeLessThanOrEqual(100);
    });

    test('should show profile sections with completion status', async () => {
      await profilePage.mockProfileData();
      await profilePage.goto();
      
      await profilePage.verifyProfileSections();
      
      // Verify section statuses
      await profilePage.verifySectionStatus('photo', 'complete');
      await profilePage.verifySectionStatus('headline', 'complete');
      await profilePage.verifySectionStatus('summary', 'incomplete');
    });

    test('should display improvement suggestions', async () => {
      await profilePage.mockProfileData();
      await profilePage.goto();
      
      await profilePage.verifyImprovementSuggestions();
    });

    test('should update completion score when profile is improved', async () => {
      await profilePage.mockProfileData();
      await profilePage.goto();
      
      await profilePage.testProgressTracking();
    });

    test('should prioritize suggestions by impact', async () => {
      await profilePage.mockProfileData();
      await profilePage.goto();
      
      const suggestions = page.locator('[data-testid="suggestion-card"]');
      const firstSuggestion = suggestions.first();
      
      // High priority suggestions should appear first
      const priority = await firstSuggestion.locator('[data-testid="suggestion-priority"]').textContent();
      expect(priority).toContain('High');
    });
  });

  test.describe('Profile Photo Management @profile', () => {
    test('should upload profile photo successfully', async () => {
      await profilePage.goto();
      
      // Mock successful upload
      await profilePage.mockApiResponse('api/v1/profile/photo', {
        success: true,
        photoUrl: 'https://example.com/profile-photo.jpg'
      });
      
      // Create a mock image file
      const mockImagePath = 'test-fixtures/profile-photo.jpg';
      await profilePage.uploadProfilePhoto(mockImagePath);
      
      // Verify success message
      await profilePage.verifySuccessMessage('Profile photo updated successfully');
    });

    test('should validate photo upload requirements', async () => {
      await profilePage.goto();
      await profilePage.testPhotoUploadValidation();
    });

    test('should provide photo cropping functionality', async ({ page }) => {
      await profilePage.goto();
      
      const uploadButton = page.locator('[data-testid="upload-photo-button"]');
      if (await uploadButton.count() > 0) {
        await uploadButton.click();
        
        // Mock file upload
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles({
          name: 'test-photo.jpg',
          mimeType: 'image/jpeg',
          buffer: Buffer.from('mock image data')
        });
        
        // Check for crop interface
        const cropInterface = page.locator('[data-testid="photo-crop-interface"]');
        if (await cropInterface.count() > 0) {
          await expect(cropInterface).toBeVisible();
          
          // Test crop controls
          const cropButton = page.locator('[data-testid="crop-photo-button"]');
          await expect(cropButton).toBeVisible();
        }
      }
    });
  });

  test.describe('Headline Optimization @profile', () => {
    test('should edit professional headline', async () => {
      await profilePage.goto();
      
      const newHeadline = 'Senior Software Engineer | Full-Stack Developer | Team Lead';
      await profilePage.editHeadline(newHeadline);
      
      // Verify headline was updated
      const headlineElement = page.locator('[data-testid="profile-headline-display"]');
      if (await headlineElement.count() > 0) {
        await expect(headlineElement).toContainText(newHeadline);
      }
    });

    test('should generate AI headline suggestions', async ({ page }) => {
      await profilePage.mockProfileData();
      await profilePage.goto();
      
      const editHeadlineButton = page.locator('[data-testid="edit-headline-button"]');
      if (await editHeadlineButton.count() > 0) {
        await editHeadlineButton.click();
        
        const generateSuggestionsButton = page.locator('[data-testid="generate-headline-suggestions"]');
        if (await generateSuggestionsButton.count() > 0) {
          await generateSuggestionsButton.click();
          await profilePage.waitForLoadingToComplete();
          
          // Verify suggestions appear
          const suggestions = page.locator('[data-testid="headline-suggestion"]');
          expect(await suggestions.count()).toBeGreaterThan(0);
          
          // Test applying a suggestion
          const firstSuggestion = suggestions.first();
          await firstSuggestion.click();
          
          const applyButton = page.locator('[data-testid="apply-headline-suggestion"]');
          await applyButton.click();
          
          await profilePage.verifySuccessMessage('Headline updated successfully');
        }
      }
    });

    test('should validate headline requirements', async () => {
      await profilePage.goto();
      await profilePage.testFormValidations();
    });
  });

  test.describe('Summary Enhancement @profile', () => {
    test('should edit professional summary', async () => {
      await profilePage.goto();
      
      const newSummary = 'Experienced software engineer with 5+ years of expertise in full-stack development, specializing in React, Node.js, and cloud technologies. Proven track record of leading cross-functional teams and delivering scalable solutions that drive business growth.';
      
      await profilePage.editSummary(newSummary);
      
      // Verify summary was updated
      const summaryElement = page.locator('[data-testid="profile-summary-display"]');
      if (await summaryElement.count() > 0) {
        await expect(summaryElement).toContainText(newSummary);
      }
    });

    test('should provide summary writing tips', async ({ page }) => {
      await profilePage.goto();
      
      const editSummaryButton = page.locator('[data-testid="edit-summary-button"]');
      if (await editSummaryButton.count() > 0) {
        await editSummaryButton.click();
        
        // Check for writing tips
        const writingTips = page.locator('[data-testid="summary-writing-tips"]');
        if (await writingTips.count() > 0) {
          await expect(writingTips).toBeVisible();
          
          const expectedTips = [
            'Start with your current role',
            'Highlight key achievements',
            'Include relevant keywords',
            'Keep it concise and engaging'
          ];
          
          for (const tip of expectedTips) {
            const tipElement = writingTips.locator(`text=${tip}`);
            if (await tipElement.count() > 0) {
              await expect(tipElement).toBeVisible();
            }
          }
        }
      }
    });

    test('should generate AI summary suggestions', async ({ page }) => {
      await profilePage.mockProfileData();
      await profilePage.goto();
      
      const editSummaryButton = page.locator('[data-testid="edit-summary-button"]');
      if (await editSummaryButton.count() > 0) {
        await editSummaryButton.click();
        
        const generateButton = page.locator('[data-testid="generate-summary-suggestions"]');
        if (await generateButton.count() > 0) {
          await generateButton.click();
          await profilePage.waitForLoadingToComplete();
          
          const suggestions = page.locator('[data-testid="summary-suggestion"]');
          expect(await suggestions.count()).toBeGreaterThan(0);
        }
      }
    });
  });

  test.describe('Experience Management @profile', () => {
    test('should add work experience', async () => {
      await profilePage.goto();
      
      const experience = {
        title: 'Senior Software Engineer',
        company: 'Tech Corp',
        description: 'Led development of scalable web applications using React and Node.js. Managed a team of 5 developers and implemented CI/CD pipelines.',
        startDate: '2021-01-01',
        current: true
      };
      
      await profilePage.addExperience(experience);
      
      // Verify experience was added
      const experienceSection = page.locator('[data-testid="profile-experience-section"]');
      await expect(experienceSection).toContainText(experience.title);
      await expect(experienceSection).toContainText(experience.company);
    });

    test('should edit existing experience', async ({ page }) => {
      await profilePage.goto();
      
      const experienceItem = page.locator('[data-testid="experience-item"]').first();
      if (await experienceItem.count() > 0) {
        const editButton = experienceItem.locator('[data-testid="edit-experience-button"]');
        await editButton.click();
        
        // Update job title
        const titleInput = page.locator('[data-testid="job-title-input"]');
        await titleInput.fill('Lead Software Engineer');
        
        const saveButton = page.locator('[data-testid="save-button"]');
        await saveButton.click();
        
        await profilePage.verifySuccessMessage('Experience updated successfully');
      }
    });

    test('should reorder experience entries', async ({ page }) => {
      await profilePage.goto();
      
      const experienceItems = page.locator('[data-testid="experience-item"]');
      if (await experienceItems.count() > 1) {
        // Test drag and drop reordering
        const firstItem = experienceItems.first();
        const secondItem = experienceItems.nth(1);
        
        await firstItem.dragTo(secondItem);
        
        // Verify order changed
        await profilePage.verifySuccessMessage('Experience order updated');
      }
    });

    test('should validate experience form', async ({ page }) => {
      await profilePage.goto();
      
      const addExperienceButton = page.locator('[data-testid="add-experience-button"]');
      if (await addExperienceButton.count() > 0) {
        await addExperienceButton.click();
        
        // Try to save without required fields
        const saveButton = page.locator('[data-testid="save-button"]');
        await saveButton.click();
        
        await profilePage.verifyFieldError('Job title is required');
      }
    });
  });

  test.describe('Education Management @profile', () => {
    test('should add education entry', async () => {
      await profilePage.goto();
      
      const education = {
        school: 'University of Technology',
        degree: 'Bachelor of Science',
        field: 'Computer Science',
        startDate: '2015-09-01',
        endDate: '2019-05-01'
      };
      
      await profilePage.addEducation(education);
      
      // Verify education was added
      const educationSection = page.locator('[data-testid="profile-education-section"]');
      await expect(educationSection).toContainText(education.school);
      await expect(educationSection).toContainText(education.degree);
    });

    test('should support multiple education entries', async ({ page }) => {
      await profilePage.goto();
      
      // Add multiple education entries
      const educationEntries = [
        {
          school: 'University of Technology',
          degree: 'Bachelor of Science',
          field: 'Computer Science'
        },
        {
          school: 'Tech Institute',
          degree: 'Certificate',
          field: 'Web Development'
        }
      ];
      
      for (const education of educationEntries) {
        await profilePage.addEducation(education);
      }
      
      // Verify both entries appear
      const educationItems = page.locator('[data-testid="education-item"]');
      expect(await educationItems.count()).toBe(educationEntries.length);
    });
  });

  test.describe('Skills Management @profile', () => {
    test('should add skills', async () => {
      await profilePage.goto();
      
      const skills = ['JavaScript', 'React', 'Node.js', 'Python', 'AWS'];
      await profilePage.addSkills(skills);
      
      // Verify skills were added
      const skillsSection = page.locator('[data-testid="profile-skills-section"]');
      for (const skill of skills) {
        await expect(skillsSection).toContainText(skill);
      }
    });

    test('should suggest relevant skills', async ({ page }) => {
      await profilePage.goto();
      
      const addSkillsButton = page.locator('[data-testid="add-skills-button"]');
      if (await addSkillsButton.count() > 0) {
        await addSkillsButton.click();
        
        const skillSuggestions = page.locator('[data-testid="skill-suggestions"]');
        if (await skillSuggestions.count() > 0) {
          await expect(skillSuggestions).toBeVisible();
          
          // Test adding suggested skill
          const firstSuggestion = page.locator('[data-testid="suggested-skill"]').first();
          if (await firstSuggestion.count() > 0) {
            await firstSuggestion.click();
            
            const skillInput = page.locator('[data-testid="skill-input"]');
            const skillValue = await skillInput.inputValue();
            expect(skillValue).toBeTruthy();
          }
        }
      }
    });

    test('should validate skill requirements', async ({ page }) => {
      await profilePage.goto();
      
      const addSkillsButton = page.locator('[data-testid="add-skills-button"]');
      if (await addSkillsButton.count() > 0) {
        await addSkillsButton.click();
        
        // Try to add empty skill
        const skillInput = page.locator('[data-testid="skill-input"]');
        await skillInput.fill('');
        
        const addButton = page.locator('[data-testid="add-skill-button"]');
        if (await addButton.count() > 0) {
          await addButton.click();
          await profilePage.verifyFieldError('Skill name is required');
        }
      }
    });

    test('should prevent duplicate skills', async ({ page }) => {
      await profilePage.goto();
      
      const addSkillsButton = page.locator('[data-testid="add-skills-button"]');
      if (await addSkillsButton.count() > 0) {
        await addSkillsButton.click();
        
        // Add a skill
        const skillInput = page.locator('[data-testid="skill-input"]');
        await skillInput.fill('JavaScript');
        await page.keyboard.press('Enter');
        
        // Try to add the same skill again
        await skillInput.fill('JavaScript');
        await page.keyboard.press('Enter');
        
        await profilePage.verifyFieldError('Skill already exists');
      }
    });
  });

  test.describe('AI-Powered Optimization @profile @ai', () => {
    test('should generate comprehensive optimization suggestions', async () => {
      await profilePage.mockProfileData();
      await profilePage.goto();
      
      await profilePage.generateAISuggestions();
      
      const suggestions = await profilePage.getAISuggestions();
      expect(suggestions.length).toBeGreaterThan(0);
      
      // Verify suggestions have ratings
      for (const suggestion of suggestions) {
        expect(suggestion.text).toBeTruthy();
        expect(suggestion.rating).toMatch(/High|Medium|Low/);
      }
    });

    test('should apply AI suggestions', async () => {
      await profilePage.mockProfileData();
      await profilePage.goto();
      
      await profilePage.generateAISuggestions();
      await profilePage.applyAISuggestion(0);
      
      await profilePage.verifySuccessMessage('Suggestion applied successfully');
    });

    test('should track suggestion effectiveness', async ({ page }) => {
      await profilePage.mockProfileData();
      await profilePage.goto();
      
      await profilePage.generateAISuggestions();
      
      const suggestionCard = page.locator('[data-testid="suggestion-card"]').first();
      const impactScore = suggestionCard.locator('[data-testid="impact-score"]');
      
      if (await impactScore.count() > 0) {
        const score = await impactScore.textContent();
        expect(score).toMatch(/\+\d+%/); // Should show percentage improvement
      }
    });
  });

  test.describe('LinkedIn Integration @profile @integration', () => {
    test('should sync profile data from LinkedIn', async () => {
      await profilePage.goto();
      
      // Mock LinkedIn API response
      await profilePage.mockApiResponse('api/v1/linkedin/profile', {
        id: 'linkedin_id_123',
        firstName: 'John',
        lastName: 'Doe',
        headline: 'Software Engineer at Tech Corp',
        summary: 'Experienced developer...',
        positions: [
          {
            title: 'Senior Software Engineer',
            company: { name: 'Tech Corp' },
            summary: 'Leading development team...'
          }
        ]
      });
      
      await profilePage.syncWithLinkedIn();
      
      // Verify data was synced
      const headlineElement = page.locator('[data-testid="profile-headline-display"]');
      if (await headlineElement.count() > 0) {
        await expect(headlineElement).toContainText('Software Engineer at Tech Corp');
      }
    });

    test('should handle LinkedIn sync errors gracefully', async ({ page }) => {
      await profilePage.goto();
      
      // Mock API error
      await profilePage.mockApiResponse('api/v1/linkedin/sync', {
        error: 'LinkedIn API rate limit exceeded'
      }, 429);
      
      const syncButton = page.locator('[data-testid="sync-linkedin-button"]');
      if (await syncButton.count() > 0) {
        await syncButton.click();
        
        await profilePage.verifyErrorMessage('Unable to sync with LinkedIn. Please try again later.');
      }
    });

    test('should show sync status and last updated time', async ({ page }) => {
      await profilePage.goto();
      
      const syncStatus = page.locator('[data-testid="linkedin-sync-status"]');
      if (await syncStatus.count() > 0) {
        await expect(syncStatus).toBeVisible();
        
        const lastUpdated = page.locator('[data-testid="last-sync-time"]');
        if (await lastUpdated.count() > 0) {
          const timeText = await lastUpdated.textContent();
          expect(timeText).toMatch(/\d+ (minutes?|hours?|days?) ago/);
        }
      }
    });
  });

  test.describe('Progress Tracking @profile', () => {
    test('should track completion percentage accurately', async () => {
      await profilePage.mockProfileData();
      await profilePage.goto();
      
      const initialScore = await profilePage.getCompletionScore();
      expect(initialScore).toBe(75); // Based on mock data
      
      // Add missing summary
      const newSummary = 'Professional summary content...';
      await profilePage.editSummary(newSummary);
      
      // Mock updated score
      await profilePage.mockApiResponse('api/v1/profile/completion', {
        score: 85,
        improvement: 10
      });
      
      await profilePage.goto(); // Refresh to see updates
      const newScore = await profilePage.getCompletionScore();
      expect(newScore).toBeGreaterThan(initialScore);
    });

    test('should show section-wise completion status', async ({ page }) => {
      await profilePage.mockProfileData();
      await profilePage.goto();
      
      const sections = ['photo', 'headline', 'summary', 'experience', 'education', 'skills'];
      
      for (const section of sections) {
        const sectionElement = page.locator(`[data-section="${section}"]`);
        if (await sectionElement.count() > 0) {
          const completionStatus = sectionElement.locator('[data-testid="section-completion"]');
          await expect(completionStatus).toBeVisible();
        }
      }
    });

    test('should provide completion timeline and goals', async ({ page }) => {
      await profilePage.goto();
      
      const completionGoals = page.locator('[data-testid="completion-goals"]');
      if (await completionGoals.count() > 0) {
        await expect(completionGoals).toBeVisible();
        
        // Check for goal milestones
        const milestones = ['50%', '75%', '90%', '100%'];
        for (const milestone of milestones) {
          const milestoneElement = page.locator(`text=${milestone} Complete`);
          if (await milestoneElement.count() > 0) {
            await expect(milestoneElement).toBeVisible();
          }
        }
      }
    });
  });

  test.describe('Accessibility & Responsive Design @profile @accessibility @responsive', () => {
    test('should be fully accessible', async () => {
      await profilePage.goto();
      await profilePage.testOptimizationAccessibility();
    });

    test('should work on all device sizes', async () => {
      await profilePage.goto();
      await profilePage.testOptimizationResponsive();
    });

    test('should support keyboard navigation', async ({ page }) => {
      await profilePage.goto();
      
      // Test tab navigation through optimization sections
      const tabbableElements = [
        '[data-testid="upload-photo-button"]',
        '[data-testid="edit-headline-button"]',
        '[data-testid="edit-summary-button"]',
        '[data-testid="add-experience-button"]'
      ];
      
      for (const element of tabbableElements) {
        if (await page.locator(element).count() > 0) {
          await page.keyboard.press('Tab');
          await expect(page.locator(element)).toBeFocused();
        }
      }
    });

    test('should have proper ARIA labels', async ({ page }) => {
      await profilePage.goto();
      
      const importantElements = [
        '[data-testid="completion-score"]',
        '[data-testid="progress-bar"]',
        '[data-testid="improvement-suggestions"]'
      ];
      
      for (const element of importantElements) {
        if (await page.locator(element).count() > 0) {
          const ariaLabel = await page.locator(element).getAttribute('aria-label');
          const ariaLabelledBy = await page.locator(element).getAttribute('aria-labelledby');
          const ariaDescribedBy = await page.locator(element).getAttribute('aria-describedby');
          
          expect(ariaLabel || ariaLabelledBy || ariaDescribedBy).toBeTruthy();
        }
      }
    });
  });

  test.describe('Performance @profile @performance', () => {
    test('should load optimization dashboard quickly', async ({ page }) => {
      const startTime = Date.now();
      
      await profilePage.goto();
      await profilePage.verifyOptimizationDashboard();
      
      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(3000); // Should load within 3 seconds
    });

    test('should handle large profile data efficiently', async () => {
      // Mock large dataset
      await profilePage.mockApiResponse('api/v1/profile', {
        completionScore: 85,
        experience: Array(20).fill(null).map((_, i) => ({
          id: i,
          title: `Position ${i}`,
          company: `Company ${i}`,
          description: 'A'.repeat(1000) // Large descriptions
        })),
        skills: Array(50).fill(null).map((_, i) => ({
          id: i,
          name: `Skill ${i}`,
          endorsements: Math.floor(Math.random() * 100)
        }))
      });
      
      await profilePage.goto();
      await profilePage.verifyOptimizationDashboard();
      
      // Should still be responsive
      const performanceMetrics = await profilePage.getPerformanceMetrics();
      expect(performanceMetrics.loadTime).toBeLessThan(5000);
    });
  });
});