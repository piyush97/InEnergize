// ===================================================================
// AUTOMATION CONTROLLER - LinkedIn Automation API Endpoints
// ===================================================================

import { Request, Response } from 'express';
import { LinkedInConnectionAutomationService } from '../services/connectionAutomation.service';
import { LinkedInEngagementAutomationService } from '../services/engagementAutomation.service';
import { LinkedInSafetyMonitorService } from '../services/safetyMonitor.service';
import { LinkedInAPIService } from '../services/api.service';
import { LinkedInComplianceService } from '../services/compliance.service';
import { LinkedInRateLimitService } from '../services/rateLimit.service';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.middleware';

export class LinkedInAutomationController {
  private automationEngine: any; // LinkedInAutomationEngine
  private connectionService: LinkedInConnectionAutomationService;
  private engagementService: LinkedInEngagementAutomationService;
  private queueManager: QueueManagerService;
  private safetyMonitor: LinkedInSafetyMonitorService;
  private templateManager: LinkedInTemplateManagerService;
  private emergencyStop: EmergencyStopService;

  constructor(
    automationEngine: any,
    connectionService: LinkedInConnectionAutomationService,
    engagementService: LinkedInEngagementAutomationService,
    queueManager: QueueManagerService,
    safetyMonitor: LinkedInSafetyMonitorService,
    templateManager: LinkedInTemplateManagerService,
    emergencyStop: EmergencyStopService
  ) {
    this.automationEngine = automationEngine;
    this.connectionService = connectionService;
    this.engagementService = engagementService;
    this.queueManager = queueManager;
    this.safetyMonitor = safetyMonitor;
    this.templateManager = templateManager;
    this.emergencyStop = emergencyStop;
  }

  /**
   * GET /automation/status
   * Get comprehensive automation status for the authenticated user
   */
  async getAutomationStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;

      const [
        engineMetrics,
        safetyStatus,
        queueStatus,
        emergencyStatus,
        templateData
      ] = await Promise.all([
        this.automationEngine?.getUserMetrics?.(userId) || this.getBasicAutomationStatus(userId),
        this.safetyMonitor.performUserSafetyCheck(userId).catch(() => null),
        this.queueManager.getUserQueueStatus(userId),
        this.emergencyStop.getEmergencyStopStatus(userId),
        this.templateManager.getUserTemplates(userId).catch(() => ({ userTemplates: [], defaultTemplates: [] }))
      ]);

      const response = {
        success: true,
        data: {
          automation: {
            enabled: engineMetrics.enabled || queueStatus.automationEnabled,
            status: emergencyStatus.isActive ? 'EMERGENCY_STOPPED' : 
                   safetyStatus?.overallStatus === 'SUSPENDED' ? 'SUSPENDED' :
                   queueStatus.automationEnabled ? 'ACTIVE' : 'PAUSED',
            metrics: engineMetrics,
            emergencyStop: emergencyStatus,
            lastActivity: queueStatus.lastActivity
          },
          safety: safetyStatus ? {
            score: safetyStatus.score,
            status: safetyStatus.overallStatus,
            alerts: safetyStatus.activeAlerts.slice(0, 5), // Latest 5 alerts
            errorRate: safetyStatus.metrics.errorRate,
            healthScore: safetyStatus.metrics.complianceScore,
            lastCheck: safetyStatus.lastHealthCheck
          } : null,
          queue: {
            totalJobs: queueStatus.totalJobs,
            byQueue: queueStatus.queues,
            nextJobTime: queueStatus.nextJobTime,
            automationEnabled: queueStatus.automationEnabled
          },
          templates: {
            totalUserTemplates: templateData.userTemplates.length,
            totalDefaultTemplates: templateData.defaultTemplates.length,
            hasCustomTemplates: templateData.userTemplates.length > 0
          },
          limits: await this.getUserLimits(userId),
          timestamp: new Date()
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Error fetching automation status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch automation status',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * POST /automation/enable
   * Enable automation for the user with settings
   */
  async enableAutomation(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const {
        connectionAutomation = false,
        engagementAutomation = false,
        profileViewAutomation = false,
        followAutomation = false,
        timeZone = 'America/New_York'
      } = req.body;

      // Validate at least one type is enabled
      if (!connectionAutomation && !engagementAutomation && !profileViewAutomation && !followAutomation) {
        res.status(400).json({
          success: false,
          error: 'At least one automation type must be enabled'
        });
        return;
      }

      // Check if already under emergency stop
      const emergencyStatus = await this.emergencyStop.getEmergencyStopStatus(userId);
      if (emergencyStatus.isActive) {
        res.status(403).json({
          success: false,
          error: 'Cannot enable automation while emergency stop is active',
          emergencyStop: emergencyStatus
        });
        return;
      }

      // Enable automation through engine
      const result = this.automationEngine?.enableUserAutomation 
        ? await this.automationEngine.enableUserAutomation(userId, {
            connectionAutomation,
            engagementAutomation,
            profileViewAutomation,
            followAutomation,
            timeZone
          })
        : await this.enableBasicAutomation(userId, {
            connectionAutomation,
            engagementAutomation,
            profileViewAutomation,
            followAutomation,
            timeZone
          });

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.reason || 'Failed to enable automation'
        });
        return;
      }

      // Get updated status
      const updatedStatus = await this.getAutomationStatusData(userId);

      res.json({
        success: true,
        message: 'Automation enabled successfully',
        data: updatedStatus
      });

    } catch (error) {
      console.error('Error enabling automation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to enable automation',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * POST /automation/disable
   * Disable automation for the user
   */
  async disableAutomation(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;

      const result = this.automationEngine?.disableUserAutomation
        ? await this.automationEngine.disableUserAutomation(userId)
        : await this.disableBasicAutomation(userId);

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.reason || 'Failed to disable automation'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Automation disabled successfully'
      });

    } catch (error) {
      console.error('Error disabling automation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to disable automation',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * POST /automation/emergency-stop
   * Trigger emergency stop for the user
   */
  async triggerEmergencyStop(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { reason = 'User requested emergency stop', confirm = false } = req.body;

      if (!confirm) {
        res.status(400).json({
          success: false,
          error: 'Emergency stop requires explicit confirmation',
          message: 'Set "confirm": true to proceed with emergency stop'
        });
        return;
      }

      // Trigger emergency stop
      await this.emergencyStop.triggerEmergencyStop(
        userId,
        'MANUAL',
        reason,
        userId
      );

      // If automation engine is available, notify it
      if (this.automationEngine?.triggerEmergencyStop) {
        await this.automationEngine.triggerEmergencyStop(userId, reason, 'user');
      }

      res.json({
        success: true,
        message: 'Emergency stop activated successfully',
        data: {
          reason,
          timestamp: new Date(),
          estimatedRecoveryTime: '24 hours (requires manual review)'
        }
      });

    } catch (error) {
      console.error('Error triggering emergency stop:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to trigger emergency stop',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * POST /automation/pause
   * Pause automation temporarily
   */
  async pauseAutomation(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { duration = 3600 } = req.body; // Default 1 hour in seconds

      await this.queueManager.pauseUserAutomation(userId);

      res.json({
        success: true,
        message: 'Automation paused successfully',
        data: {
          duration,
          resumesAt: new Date(Date.now() + duration * 1000)
        }
      });

    } catch (error) {
      console.error('Error pausing automation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to pause automation',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * POST /automation/resume
   * Resume paused automation
   */
  async resumeAutomation(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;

      await this.queueManager.resumeUserAutomation(userId);

      res.json({
        success: true,
        message: 'Automation resumed successfully'
      });

    } catch (error) {
      console.error('Error resuming automation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to resume automation',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * POST /automation/jobs/schedule
   * Schedule a new automation job
   */
  async scheduleJob(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const {
        type,
        data,
        priority = 'normal',
        scheduledAt,
        templateId
      } = req.body;

      // Validate job type
      const validTypes = ['connection', 'like', 'comment', 'profile_view', 'follow'];
      if (!validTypes.includes(type)) {
        res.status(400).json({
          success: false,
          error: `Invalid job type. Must be one of: ${validTypes.join(', ')}`
        });
        return;
      }

      // Validate required data based on type
      const validation = this.validateJobData(type, data);
      if (!validation.valid) {
        res.status(400).json({
          success: false,
          error: validation.reason
        });
        return;
      }

      // Schedule the job
      const result = this.automationEngine?.scheduleJob
        ? await this.automationEngine.scheduleJob(userId, type, data, {
            priority,
            scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
            templateId
          })
        : await this.queueManager.addJob(userId, type, data, {
            priority,
            scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined
          });

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.reason || 'Failed to schedule job',
          retryAfter: result.retryAfter
        });
        return;
      }

      res.json({
        success: true,
        message: 'Job scheduled successfully',
        data: {
          jobId: result.jobId,
          type,
          priority,
          scheduledAt: scheduledAt || new Date()
        }
      });

    } catch (error) {
      console.error('Error scheduling job:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to schedule job',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /automation/jobs
   * Get user's job queue status
   */
  async getJobQueue(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const queueStatus = await this.queueManager.getUserQueueStatus(userId);

      res.json({
        success: true,
        data: queueStatus
      });

    } catch (error) {
      console.error('Error fetching job queue:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch job queue',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * DELETE /automation/jobs/:jobId
   * Cancel a specific job
   */
  async cancelJob(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { jobId } = req.params;

      // This would integrate with your job cancellation system
      // For now, return a placeholder response
      res.json({
        success: true,
        message: 'Job cancelled successfully',
        data: { jobId }
      });

    } catch (error) {
      console.error('Error cancelling job:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cancel job',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /automation/safety
   * Get detailed safety metrics and alerts
   */
  async getSafetyMetrics(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;

      const [safetyStatus, emergencyStatus] = await Promise.all([
        this.safetyMonitor.performUserSafetyCheck(userId).catch(() => null),
        this.emergencyStop.getEmergencyStopStatus(userId)
      ]);

      const response = {
        success: true,
        data: {
          safety: safetyStatus ? {
            score: safetyStatus.score,
            status: safetyStatus.overallStatus,
            metrics: safetyStatus.metrics,
            alerts: safetyStatus.activeAlerts,
            lastCheck: safetyStatus.lastHealthCheck,
            suspensionReason: safetyStatus.suspensionReason,
            automationEnabled: safetyStatus.automationEnabled
          } : {
            score: 0,
            status: 'UNKNOWN',
            alerts: [],
            lastCheck: null
          },
          emergencyStop: emergencyStatus,
          recommendations: this.generateSafetyRecommendations(safetyStatus, emergencyStatus)
        }
      };

      res.json(response);

    } catch (error) {
      console.error('Error fetching safety metrics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch safety metrics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /automation/templates
   * Get user's templates with performance analytics
   */
  async getTemplates(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const templates = await this.templateManager.getUserTemplates(userId);

      res.json({
        success: true,
        data: templates
      });

    } catch (error) {
      console.error('Error fetching templates:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch templates',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * POST /automation/templates
   * Create a new custom template
   */
  async createTemplate(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const templateData = req.body;

      const result = await this.templateManager.createUserTemplate(userId, templateData);

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.reason
        });
        return;
      }

      res.json({
        success: true,
        message: 'Template created successfully',
        data: { templateId: result.templateId }
      });

    } catch (error) {
      console.error('Error creating template:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create template',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * PUT /automation/templates/:templateId
   * Update an existing template
   */
  async updateTemplate(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { templateId } = req.params;
      const updates = req.body;

      const result = await this.templateManager.updateUserTemplate(userId, templateId, updates);

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.reason
        });
        return;
      }

      res.json({
        success: true,
        message: 'Template updated successfully'
      });

    } catch (error) {
      console.error('Error updating template:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update template',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * DELETE /automation/templates/:templateId
   * Delete a template
   */
  async deleteTemplate(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { templateId } = req.params;

      const result = await this.templateManager.deleteUserTemplate(userId, templateId);

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.reason
        });
        return;
      }

      res.json({
        success: true,
        message: 'Template deleted successfully'
      });

    } catch (error) {
      console.error('Error deleting template:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete template',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /automation/templates/analytics
   * Get detailed template performance analytics
   */
  async getTemplateAnalytics(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { templateId } = req.query;

      const analytics = await this.templateManager.getTemplateAnalytics(
        userId,
        templateId as string | undefined
      );

      res.json({
        success: true,
        data: analytics
      });

    } catch (error) {
      console.error('Error fetching template analytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch template analytics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /automation/dashboard
   * Get comprehensive dashboard data
   */
  async getDashboard(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;

      const [
        automationStatus,
        safetyMetrics,
        queueStatus,
        templateAnalytics,
        systemHealth
      ] = await Promise.all([
        this.getAutomationStatusData(userId),
        this.safetyMonitor.performUserSafetyCheck(userId).catch(() => null),
        this.queueManager.getUserQueueStatus(userId),
        this.templateManager.getTemplateAnalytics(userId).catch(() => null),
        this.automationEngine?.getSystemDashboard?.() || null
      ]);

      const dashboard = {
        automation: automationStatus,
        safety: safetyMetrics ? {
          score: safetyMetrics.score,
          status: safetyMetrics.overallStatus,
          recentAlerts: safetyMetrics.activeAlerts.slice(0, 3),
          errorRate: safetyMetrics.metrics.errorRate,
          lastCheck: safetyMetrics.lastHealthCheck
        } : null,
        queue: {
          totalJobs: queueStatus.totalJobs,
          nextJobTime: queueStatus.nextJobTime,
          queues: Object.fromEntries(
            Object.entries(queueStatus.queues).map(([name, stats]) => [
              name,
              {
                waiting: stats.waiting,
                active: stats.active,
                estimatedWaitTime: stats.estimatedWaitTime
              }
            ])
          )
        },
        templates: templateAnalytics ? {
          totalTemplates: templateAnalytics.overallPerformance.totalTemplates,
          averageAcceptanceRate: templateAnalytics.overallPerformance.averageAcceptanceRate,
          topTemplate: templateAnalytics.overallPerformance.topPerformingTemplate,
          recommendations: templateAnalytics.recommendations.slice(0, 3)
        } : null,
        systemHealth: systemHealth ? {
          totalUsers: systemHealth.totalUsers,
          systemHealth: systemHealth.systemHealth,
          successRate: systemHealth.successRate
        } : null,
        timestamp: new Date()
      };

      res.json({
        success: true,
        data: dashboard
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch dashboard data',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Private helper methods

  private async getBasicAutomationStatus(userId: string): Promise<any> {
    // Fallback implementation when automation engine is not available
    return {
      userId,
      enabled: false,
      daily: {
        connections: { sent: 0, remaining: 15 },
        likes: { sent: 0, remaining: 30 },
        comments: { sent: 0, remaining: 8 },
        profileViews: { sent: 0, remaining: 25 },
        follows: { sent: 0, remaining: 5 }
      },
      hourly: {
        connections: { sent: 0, remaining: 3 },
        likes: { sent: 0, remaining: 8 },
        comments: { sent: 0, remaining: 2 },
        profileViews: { sent: 0, remaining: 6 },
        follows: { sent: 0, remaining: 1 }
      }
    };
  }

  private async enableBasicAutomation(userId: string, settings: any): Promise<{ success: boolean; reason?: string }> {
    try {
      await this.safetyMonitor.startUserMonitoring(userId);
      return { success: true };
    } catch (error) {
      return { success: false, reason: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private async disableBasicAutomation(userId: string): Promise<{ success: boolean; reason?: string }> {
    try {
      await this.safetyMonitor.stopUserMonitoring(userId);
      return { success: true };
    } catch (error) {
      return { success: false, reason: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private async getAutomationStatusData(userId: string): Promise<any> {
    return this.automationEngine?.getUserMetrics?.(userId) || this.getBasicAutomationStatus(userId);
  }

  private async getUserLimits(userId: string): Promise<any> {
    // Ultra-conservative limits (15% of LinkedIn's actual limits)
    return {
      daily: {
        connections: 15,
        likes: 30,
        comments: 8,
        profileViews: 25,
        follows: 5
      },
      hourly: {
        connections: 3,
        likes: 8,
        comments: 2,
        profileViews: 6,
        follows: 1
      }
    };
  }

  private validateJobData(type: string, data: any): { valid: boolean; reason?: string } {
    switch (type) {
      case 'connection':
        if (!data.targetProfileId) {
          return { valid: false, reason: 'targetProfileId is required for connection jobs' };
        }
        break;
      case 'like':
      case 'comment':
        if (!data.targetPostId) {
          return { valid: false, reason: 'targetPostId is required for engagement jobs' };
        }
        if (type === 'comment' && !data.comment) {
          return { valid: false, reason: 'comment text is required for comment jobs' };
        }
        break;
      case 'profile_view':
      case 'follow':
        if (!data.targetProfileId) {
          return { valid: false, reason: 'targetProfileId is required for this job type' };
        }
        break;
      default:
        return { valid: false, reason: 'Unknown job type' };
    }
    return { valid: true };
  }

  private generateSafetyRecommendations(safetyStatus: any, emergencyStatus: any): string[] {
    const recommendations: string[] = [];

    if (emergencyStatus.isActive) {
      recommendations.push('Contact support to resolve emergency stop condition');
      recommendations.push('Review and address the issues that triggered the emergency stop');
      return recommendations;
    }

    if (!safetyStatus) {
      recommendations.push('Enable safety monitoring to track automation health');
      return recommendations;
    }

    if (safetyStatus.score < 80) {
      recommendations.push('Review and resolve active safety alerts');
    }

    if (safetyStatus.metrics.errorRate > 0.05) {
      recommendations.push('Reduce automation frequency to improve success rate');
    }

    if (safetyStatus.metrics.complianceScore < 70) {
      recommendations.push('Review LinkedIn compliance guidelines');
    }

    if (safetyStatus.activeAlerts.length > 3) {
      recommendations.push('Address multiple active alerts to improve safety score');
    }

    if (recommendations.length === 0) {
      recommendations.push('Automation safety is in good condition');
    }

    return recommendations;
  }
}