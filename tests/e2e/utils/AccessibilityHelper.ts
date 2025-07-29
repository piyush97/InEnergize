import { Page, expect } from '@playwright/test';

/**
 * Accessibility testing helper utilities for WCAG 2.1 AA compliance
 */
export class AccessibilityHelper {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Comprehensive accessibility audit
   */
  async auditPage(): Promise<AccessibilityReport> {
    const report: AccessibilityReport = {
      url: this.page.url(),
      timestamp: new Date().toISOString(),
      violations: [],
      warnings: [],
      passes: [],
      summary: {
        violationCount: 0,
        warningCount: 0,
        passCount: 0,
        score: 0
      }
    };

    // Run all accessibility checks
    await Promise.all([
      this.checkHeadingHierarchy(report),
      this.checkColorContrast(report),
      this.checkKeyboardNavigation(report),
      this.checkAriaLabels(report),
      this.checkFocusManagement(report),
      this.checkAlternativeText(report),
      this.checkFormLabels(report),
      this.checkLandmarks(report),
      this.checkTabIndex(report),
      this.checkSemanticStructure(report)
    ]);

    // Calculate summary
    report.summary.violationCount = report.violations.length;
    report.summary.warningCount = report.warnings.length;
    report.summary.passCount = report.passes.length;
    
    // Calculate accessibility score (0-100)
    const totalChecks = report.summary.violationCount + report.summary.warningCount + report.summary.passCount;
    if (totalChecks > 0) {
      report.summary.score = Math.round((report.summary.passCount / totalChecks) * 100);
    }

    return report;
  }

  /**
   * Check heading hierarchy (WCAG 1.3.1)
   */
  private async checkHeadingHierarchy(report: AccessibilityReport): Promise<void> {
    try {
      const headings = await this.page.locator('h1, h2, h3, h4, h5, h6').all();
      
      if (headings.length === 0) {
        report.warnings.push({
          rule: 'heading-hierarchy',
          description: 'Page has no headings',
          severity: 'warning',
          wcag: '1.3.1'
        });
        return;
      }

      // Check for exactly one H1
      const h1Count = await this.page.locator('h1').count();
      if (h1Count === 0) {
        report.violations.push({
          rule: 'heading-hierarchy',
          description: 'Page must have exactly one H1 element',
          severity: 'error',
          wcag: '1.3.1',
          element: 'Missing H1'
        });
      } else if (h1Count > 1) {
        report.violations.push({
          rule: 'heading-hierarchy',
          description: 'Page has multiple H1 elements',
          severity: 'error',
          wcag: '1.3.1',
          element: `${h1Count} H1 elements found`
        });
      } else {
        report.passes.push({
          rule: 'heading-hierarchy',
          description: 'Page has exactly one H1 element',
          wcag: '1.3.1'
        });
      }

      // Check heading sequence
      const headingLevels: number[] = [];
      for (const heading of headings) {
        const tagName = await heading.evaluate(el => el.tagName.toLowerCase());
        const level = parseInt(tagName.charAt(1));
        headingLevels.push(level);
      }

      let previousLevel = 0;
      for (let i = 0; i < headingLevels.length; i++) {
        const currentLevel = headingLevels[i];
        
        if (currentLevel - previousLevel > 1) {
          report.violations.push({
            rule: 'heading-hierarchy',
            description: `Heading level skipped from H${previousLevel} to H${currentLevel}`,
            severity: 'error',
            wcag: '1.3.1',
            element: `H${currentLevel} at position ${i + 1}`
          });
        }
        
        previousLevel = currentLevel;
      }

      if (report.violations.filter(v => v.rule === 'heading-hierarchy').length === 0) {
        report.passes.push({
          rule: 'heading-hierarchy',
          description: 'Heading hierarchy is properly structured',
          wcag: '1.3.1'
        });
      }
    } catch (error) {
      report.warnings.push({
        rule: 'heading-hierarchy',
        description: `Error checking heading hierarchy: ${error}`,
        severity: 'warning',
        wcag: '1.3.1'
      });
    }
  }

  /**
   * Check color contrast (WCAG 1.4.3)
   */
  private async checkColorContrast(report: AccessibilityReport): Promise<void> {
    try {
      // This is a simplified check - in production, use axe-core or similar
      const textElements = await this.page.locator('p, span, div, a, button, label, h1, h2, h3, h4, h5, h6').all();
      
      let contrastIssues = 0;
      let checkedElements = 0;

      for (const element of textElements.slice(0, 50)) { // Check first 50 elements
        try {
          const styles = await element.evaluate(el => {
            const computed = window.getComputedStyle(el);
            return {
              color: computed.color,
              backgroundColor: computed.backgroundColor,
              fontSize: computed.fontSize
            };
          });

          // Skip elements with no visible text
          const text = await element.textContent();
          if (!text || text.trim().length === 0) continue;

          checkedElements++;

          // Simple contrast check (would use proper color contrast calculation in production)
          if (styles.color === styles.backgroundColor) {
            contrastIssues++;
          }
        } catch (e) {
          // Skip elements that can't be evaluated
          continue;
        }
      }

      if (contrastIssues > 0) {
        report.violations.push({
          rule: 'color-contrast',
          description: `${contrastIssues} elements may have insufficient color contrast`,
          severity: 'error',
          wcag: '1.4.3',
          element: `${contrastIssues} of ${checkedElements} elements`
        });
      } else if (checkedElements > 0) {
        report.passes.push({
          rule: 'color-contrast',
          description: `Color contrast appears adequate for ${checkedElements} elements`,
          wcag: '1.4.3'
        });
      }
    } catch (error) {
      report.warnings.push({
        rule: 'color-contrast',
        description: `Error checking color contrast: ${error}`,
        severity: 'warning',
        wcag: '1.4.3'
      });
    }
  }

  /**
   * Check keyboard navigation (WCAG 2.1.1)
   */
  private async checkKeyboardNavigation(report: AccessibilityReport): Promise<void> {
    try {
      const focusableElements = await this.page.locator(
        'a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ).all();

      if (focusableElements.length === 0) {
        report.warnings.push({
          rule: 'keyboard-navigation',
          description: 'No focusable elements found on page',
          severity: 'warning',
          wcag: '2.1.1'
        });
        return;
      }

      let keyboardAccessibleCount = 0;
      let totalFocusable = 0;

      for (const element of focusableElements.slice(0, 20)) { // Test first 20 elements
        try {
          totalFocusable++;
          
          // Try to focus the element
          await element.focus();
          const isFocused = await element.evaluate(el => el === document.activeElement);
          
          if (isFocused) {
            keyboardAccessibleCount++;
          }
          
          // Check for keyboard event handlers
          const hasKeyboardHandlers = await element.evaluate(el => {
            return el.onkeydown !== null || 
                   el.onkeyup !== null || 
                   el.onkeypress !== null ||
                   el.getAttribute('role') === 'button';
          });

          if (!hasKeyboardHandlers && await element.evaluate(el => el.tagName.toLowerCase() === 'div')) {
            report.warnings.push({
              rule: 'keyboard-navigation',
              description: 'Interactive div element may not be keyboard accessible',
              severity: 'warning',
              wcag: '2.1.1',
              element: await element.evaluate(el => `${el.tagName.toLowerCase()}${el.className ? '.' + el.className.split(' ')[0] : ''}`)
            });
          }
        } catch (e) {
          // Skip elements that can't be focused
          continue;
        }
      }

      const accessibilityRatio = keyboardAccessibleCount / totalFocusable;
      if (accessibilityRatio < 0.9) {
        report.violations.push({
          rule: 'keyboard-navigation',
          description: `Only ${keyboardAccessibleCount} of ${totalFocusable} focusable elements are keyboard accessible`,
          severity: 'error',
          wcag: '2.1.1',
          element: `${Math.round(accessibilityRatio * 100)}% keyboard accessible`
        });
      } else {
        report.passes.push({
          rule: 'keyboard-navigation',
          description: `${keyboardAccessibleCount} of ${totalFocusable} elements are keyboard accessible`,
          wcag: '2.1.1'
        });
      }
    } catch (error) {
      report.warnings.push({
        rule: 'keyboard-navigation',
        description: `Error checking keyboard navigation: ${error}`,
        severity: 'warning',
        wcag: '2.1.1'
      });
    }
  }

  /**
   * Check ARIA labels (WCAG 1.3.1, 4.1.2)
   */
  private async checkAriaLabels(report: AccessibilityReport): Promise<void> {
    try {
      // Check buttons without accessible names
      const buttons = await this.page.locator('button, [role="button"]').all();
      let unlabeledButtons = 0;

      for (const button of buttons) {
        const hasLabel = await button.evaluate(el => {
          return !!(
            el.textContent?.trim() ||
            el.getAttribute('aria-label') ||
            el.getAttribute('aria-labelledby') ||
            el.getAttribute('title')
          );
        });

        if (!hasLabel) {
          unlabeledButtons++;
        }
      }

      if (unlabeledButtons > 0) {
        report.violations.push({
          rule: 'aria-labels',
          description: `${unlabeledButtons} buttons lack accessible names`,
          severity: 'error',
          wcag: '4.1.2',
          element: `${unlabeledButtons} unlabeled buttons`
        });
      } else if (buttons.length > 0) {
        report.passes.push({
          rule: 'aria-labels',
          description: `All ${buttons.length} buttons have accessible names`,
          wcag: '4.1.2'
        });
      }

      // Check form inputs without labels
      const inputs = await this.page.locator('input, select, textarea').all();
      let unlabeledInputs = 0;

      for (const input of inputs) {
        const hasLabel = await input.evaluate(el => {
          const id = el.getAttribute('id');
          return !!(
            el.getAttribute('aria-label') ||
            el.getAttribute('aria-labelledby') ||
            el.getAttribute('placeholder') ||
            (id && document.querySelector(`label[for="${id}"]`))
          );
        });

        if (!hasLabel) {
          unlabeledInputs++;
        }
      }

      if (unlabeledInputs > 0) {
        report.violations.push({
          rule: 'aria-labels',
          description: `${unlabeledInputs} form inputs lack accessible labels`,
          severity: 'error',
          wcag: '1.3.1',
          element: `${unlabeledInputs} unlabeled inputs`
        });
      } else if (inputs.length > 0) {
        report.passes.push({
          rule: 'aria-labels',
          description: `All ${inputs.length} form inputs have accessible labels`,
          wcag: '1.3.1'
        });
      }
    } catch (error) {
      report.warnings.push({
        rule: 'aria-labels',
        description: `Error checking ARIA labels: ${error}`,
        severity: 'warning',
        wcag: '1.3.1'
      });
    }
  }

  /**
   * Check focus management (WCAG 2.4.3)
   */
  private async checkFocusManagement(report: AccessibilityReport): Promise<void> {
    try {
      // Check for focus traps in modals
      const modals = await this.page.locator('[role="dialog"], .modal, [data-testid*="modal"]').all();
      
      for (const modal of modals) {
        const isVisible = await modal.isVisible();
        if (isVisible) {
          const focusableInModal = await modal.locator(
            'a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
          ).count();
          
          if (focusableInModal === 0) {
            report.violations.push({
              rule: 'focus-management',
              description: 'Modal dialog has no focusable elements',
              severity: 'error',
              wcag: '2.4.3',
              element: 'Modal dialog'
            });
          }
        }
      }

      // Check for skip links
      const skipLinks = await this.page.locator('a[href="#main-content"], a[href="#content"]').count();
      if (skipLinks === 0) {
        report.warnings.push({
          rule: 'focus-management',
          description: 'Page lacks skip links for keyboard navigation',
          severity: 'warning',
          wcag: '2.4.1',
          element: 'Missing skip links'
        });
      } else {
        report.passes.push({
          rule: 'focus-management',
          description: 'Page has skip links for keyboard navigation',
          wcag: '2.4.1'
        });
      }

      // Check focus indicators
      const focusIndicatorCheck = await this.page.evaluate(() => {
        const focusableElements = document.querySelectorAll('a, button, input, select, textarea');
        let elementsWithFocusStyle = 0;
        
        focusableElements.forEach(el => {
          const styles = window.getComputedStyle(el, ':focus');
          if (styles.outline !== 'none' || styles.boxShadow !== 'none') {
            elementsWithFocusStyle++;
          }
        });
        
        return {
          total: focusableElements.length,
          withFocusStyle: elementsWithFocusStyle
        };
      });

      if (focusIndicatorCheck.withFocusStyle < focusIndicatorCheck.total * 0.8) {
        report.violations.push({
          rule: 'focus-management',
          description: 'Some focusable elements lack visible focus indicators',
          severity: 'error',
          wcag: '2.4.7',
          element: `${focusIndicatorCheck.withFocusStyle}/${focusIndicatorCheck.total} have focus styles`
        });
      } else if (focusIndicatorCheck.total > 0) {
        report.passes.push({
          rule: 'focus-management',
          description: 'Focusable elements have visible focus indicators',
          wcag: '2.4.7'
        });
      }
    } catch (error) {
      report.warnings.push({
        rule: 'focus-management',
        description: `Error checking focus management: ${error}`,
        severity: 'warning',
        wcag: '2.4.3'
      });
    }
  }

  /**
   * Check alternative text for images (WCAG 1.1.1)
   */
  private async checkAlternativeText(report: AccessibilityReport): Promise<void> {
    try {
      const images = await this.page.locator('img').all();
      let imagesWithoutAlt = 0;
      let decorativeImages = 0;

      for (const img of images) {
        const alt = await img.getAttribute('alt');
        const role = await img.getAttribute('role');
        
        if (alt === null) {
          imagesWithoutAlt++;
        } else if (alt === '' && role !== 'presentation') {
          // Empty alt should have role="presentation" for decorative images
          decorativeImages++;
        }
      }

      if (imagesWithoutAlt > 0) {
        report.violations.push({
          rule: 'alternative-text',
          description: `${imagesWithoutAlt} images lack alt attributes`,
          severity: 'error',
          wcag: '1.1.1',
          element: `${imagesWithoutAlt} images without alt`
        });
      }

      if (decorativeImages > 0) {
        report.warnings.push({
          rule: 'alternative-text',
          description: `${decorativeImages} images with empty alt should have role="presentation"`,
          severity: 'warning',
          wcag: '1.1.1',
          element: `${decorativeImages} decorative images`
        });
      }

      if (images.length > 0 && imagesWithoutAlt === 0) {
        report.passes.push({
          rule: 'alternative-text',
          description: `All ${images.length} images have alt attributes`,
          wcag: '1.1.1'
        });
      }
    } catch (error) {
      report.warnings.push({
        rule: 'alternative-text',
        description: `Error checking alternative text: ${error}`,
        severity: 'warning',
        wcag: '1.1.1'
      });
    }
  }

  /**
   * Check form labels (WCAG 1.3.1, 3.3.2)
   */
  private async checkFormLabels(report: AccessibilityReport): Promise<void> {
    try {
      const forms = await this.page.locator('form').all();
      
      for (const form of forms) {
        const inputs = await form.locator('input, select, textarea').all();
        let unlabeledInputs = 0;
        let inputsWithErrors = 0;

        for (const input of inputs) {
          const type = await input.getAttribute('type');
          
          // Skip hidden inputs
          if (type === 'hidden') continue;

          const hasLabel = await input.evaluate(el => {
            const id = el.getAttribute('id');
            return !!(
              el.getAttribute('aria-label') ||
              el.getAttribute('aria-labelledby') ||
              (id && document.querySelector(`label[for="${id}"]`)) ||
              el.closest('label')
            );
          });

          if (!hasLabel) {
            unlabeledInputs++;
          }

          // Check for error messages
          const hasErrorMessage = await input.evaluate(el => {
            return !!(
              el.getAttribute('aria-describedby') ||
              el.getAttribute('aria-invalid') === 'true'
            );
          });

          const isRequired = await input.evaluate(el => {
            return el.hasAttribute('required') || el.getAttribute('aria-required') === 'true';
          });

          if (isRequired && !hasErrorMessage) {
            inputsWithErrors++;
          }
        }

        if (unlabeledInputs > 0) {
          report.violations.push({
            rule: 'form-labels',
            description: `Form has ${unlabeledInputs} unlabeled inputs`,
            severity: 'error',
            wcag: '1.3.1',
            element: 'Form inputs'
          });
        }

        if (inputsWithErrors > 0) {
          report.warnings.push({
            rule: 'form-labels',
            description: `Form has ${inputsWithErrors} required inputs without error messaging`,
            severity: 'warning',
            wcag: '3.3.2',
            element: 'Required form inputs'
          });
        }
      }

      if (forms.length > 0 && report.violations.filter(v => v.rule === 'form-labels').length === 0) {
        report.passes.push({
          rule: 'form-labels',
          description: 'All form inputs have appropriate labels',
          wcag: '1.3.1'
        });
      }
    } catch (error) {
      report.warnings.push({
        rule: 'form-labels',
        description: `Error checking form labels: ${error}`,
        severity: 'warning',
        wcag: '1.3.1'
      });
    }
  }

  /**
   * Check landmark regions (WCAG 1.3.1)
   */
  private async checkLandmarks(report: AccessibilityReport): Promise<void> {
    try {
      const landmarks = await this.page.locator(
        'main, [role="main"], header, [role="banner"], footer, [role="contentinfo"], nav, [role="navigation"], aside, [role="complementary"]'
      ).count();

      const hasMain = await this.page.locator('main, [role="main"]').count() > 0;
      
      if (!hasMain) {
        report.violations.push({
          rule: 'landmarks',
          description: 'Page lacks a main landmark region',
          severity: 'error',
          wcag: '1.3.1',
          element: 'Missing main landmark'
        });
      } else {
        report.passes.push({
          rule: 'landmarks',
          description: 'Page has a main landmark region',
          wcag: '1.3.1'
        });
      }

      if (landmarks < 2) {
        report.warnings.push({
          rule: 'landmarks',
          description: 'Page has minimal landmark structure',
          severity: 'warning',
          wcag: '1.3.1',
          element: `${landmarks} landmarks found`
        });
      } else {
        report.passes.push({
          rule: 'landmarks',
          description: `Page has ${landmarks} landmark regions for navigation`,
          wcag: '1.3.1'
        });
      }
    } catch (error) {
      report.warnings.push({
        rule: 'landmarks',
        description: `Error checking landmarks: ${error}`,
        severity: 'warning',
        wcag: '1.3.1'
      });
    }
  }

  /**
   * Check tabindex usage (WCAG 2.4.3)
   */
  private async checkTabIndex(report: AccessibilityReport): Promise<void> {
    try {
      const positiveTabIndex = await this.page.locator('[tabindex]:not([tabindex="0"]):not([tabindex="-1"])').all();
      
      if (positiveTabIndex.length > 0) {
        const tabIndexValues = await Promise.all(
          positiveTabIndex.map(el => el.getAttribute('tabindex'))
        );
        
        report.warnings.push({
          rule: 'tabindex',
          description: `${positiveTabIndex.length} elements use positive tabindex values`,
          severity: 'warning',
          wcag: '2.4.3',
          element: `tabindex values: ${tabIndexValues.join(', ')}`
        });
      } else {
        report.passes.push({
          rule: 'tabindex',
          description: 'No positive tabindex values found (good practice)',
          wcag: '2.4.3'
        });
      }

      // Check for excessive negative tabindex
      const negativeTabIndex = await this.page.locator('[tabindex="-1"]').count();
      if (negativeTabIndex > 10) {
        report.warnings.push({
          rule: 'tabindex',
          description: `Excessive use of tabindex="-1" (${negativeTabIndex} elements)`,
          severity: 'warning',
          wcag: '2.4.3',
          element: `${negativeTabIndex} elements with tabindex="-1"`
        });
      }
    } catch (error) {
      report.warnings.push({
        rule: 'tabindex',
        description: `Error checking tabindex: ${error}`,
        severity: 'warning',
        wcag: '2.4.3'
      });
    }
  }

  /**
   * Check semantic structure (WCAG 1.3.1)
   */
  private async checkSemanticStructure(report: AccessibilityReport): Promise<void> {
    try {
      // Check for proper use of lists
      const lists = await this.page.locator('ul, ol, dl').count();
      const listItems = await this.page.locator('li, dt, dd').count();
      
      if (lists > 0 && listItems === 0) {
        report.violations.push({
          rule: 'semantic-structure',
          description: 'List elements found without list items',
          severity: 'error',
          wcag: '1.3.1',
          element: `${lists} empty lists`
        });
      }

      // Check for proper table structure
      const tables = await this.page.locator('table').all();
      for (const table of tables) {
        const hasHeaders = await table.locator('th').count() > 0;
        const hasCaption = await table.locator('caption').count() > 0;
        
        if (!hasHeaders) {
          report.violations.push({
            rule: 'semantic-structure',
            description: 'Table lacks header cells (th elements)',
            severity: 'error',
            wcag: '1.3.1',
            element: 'Table without headers'
          });
        }
        
        if (!hasCaption) {
          report.warnings.push({
            rule: 'semantic-structure',
            description: 'Table lacks caption for context',
            severity: 'warning',
            wcag: '1.3.1',
            element: 'Table without caption'
          });
        }
      }

      // Check for semantic HTML5 elements
      const semanticElements = await this.page.locator(
        'article, section, aside, nav, header, footer, main'
      ).count();
      
      if (semanticElements >= 3) {
        report.passes.push({
          rule: 'semantic-structure',
          description: `Page uses ${semanticElements} semantic HTML5 elements`,
          wcag: '1.3.1'
        });
      } else {
        report.warnings.push({
          rule: 'semantic-structure',
          description: 'Limited use of semantic HTML5 elements',
          severity: 'warning',
          wcag: '1.3.1',
          element: `Only ${semanticElements} semantic elements found`
        });
      }
    } catch (error) {
      report.warnings.push({
        rule: 'semantic-structure',
        description: `Error checking semantic structure: ${error}`,
        severity: 'warning',
        wcag: '1.3.1'
      });
    }
  }

  /**
   * Generate accessibility report
   */
  async generateReport(report: AccessibilityReport): Promise<string> {
    const reportLines: string[] = [];
    
    reportLines.push('# Accessibility Audit Report');
    reportLines.push(`**URL:** ${report.url}`);
    reportLines.push(`**Timestamp:** ${report.timestamp}`);
    reportLines.push(`**Score:** ${report.summary.score}/100`);
    reportLines.push('');
    
    reportLines.push('## Summary');
    reportLines.push(`- ✅ Passes: ${report.summary.passCount}`);
    reportLines.push(`- ⚠️ Warnings: ${report.summary.warningCount}`);
    reportLines.push(`- ❌ Violations: ${report.summary.violationCount}`);
    reportLines.push('');
    
    if (report.violations.length > 0) {
      reportLines.push('## Violations (Must Fix)');
      report.violations.forEach(violation => {
        reportLines.push(`### ${violation.rule} (WCAG ${violation.wcag})`);
        reportLines.push(`**Severity:** ${violation.severity}`);
        reportLines.push(`**Description:** ${violation.description}`);
        if (violation.element) {
          reportLines.push(`**Element:** ${violation.element}`);
        }
        reportLines.push('');
      });
    }
    
    if (report.warnings.length > 0) {
      reportLines.push('## Warnings (Should Fix)');
      report.warnings.forEach(warning => {
        reportLines.push(`### ${warning.rule} (WCAG ${warning.wcag || 'N/A'})`);
        reportLines.push(`**Description:** ${warning.description}`);
        if (warning.element) {
          reportLines.push(`**Element:** ${warning.element}`);
        }
        reportLines.push('');
      });
    }
    
    if (report.passes.length > 0) {
      reportLines.push('## Passed Checks');
      report.passes.forEach(pass => {
        reportLines.push(`- ✅ ${pass.rule}: ${pass.description} (WCAG ${pass.wcag})`);
      });
    }
    
    return reportLines.join('\n');
  }
}

// Type definitions
export interface AccessibilityReport {
  url: string;
  timestamp: string;
  violations: AccessibilityIssue[];
  warnings: AccessibilityIssue[];
  passes: AccessibilityPass[];
  summary: {
    violationCount: number;
    warningCount: number;
    passCount: number;
    score: number;
  };
}

export interface AccessibilityIssue {
  rule: string;
  description: string;
  severity: 'error' | 'warning';
  wcag?: string;
  element?: string;
}

export interface AccessibilityPass {
  rule: string;
  description: string;
  wcag: string;
}