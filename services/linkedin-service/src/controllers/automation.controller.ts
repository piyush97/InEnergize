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
  private connectionService: LinkedInConnectionAutomationService;
  private engagementService: LinkedInEngagementAutomationService;
  private safetyService: LinkedInSafetyMonitorService;

  constructor() {
    // Initialize services (in practice, these would be dependency injected)
    const apiService = new LinkedInAPIService();
    const complianceService = new LinkedInComplianceService();
    const rateLimitService = new LinkedInRateLimitService();

    this.connectionService = new LinkedInConnectionAutomationService(
      apiService, 
      complianceService, 
      rateLimitService
    );
    this.engagementService = new LinkedInEngagementAutomationService(
      apiService, 
      complianceService, 
      rateLimitService
    );
    this.safetyService = new LinkedInSafetyMonitorService(
      complianceService, 
      rateLimitService
    );
  }

  // ===================================================================
  // CONNECTION AUTOMATION ENDPOINTS
  // ===================================================================

  /**
   * Schedule a connection request
   */
  scheduleConnection = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { targetProfileId, message, templateId, priority, scheduledAt } = req.body;

      if (!targetProfileId) {
        res.status(400).json({ error: 'targetProfileId is required' });
        return;
      }

      // Check if automation is suspended
      const suspensionCheck = await this.safetyService.isUserAutomationSuspended(userId);
      if (suspensionCheck.suspended) {
        res.status(403).json({ 
          error: 'Automation suspended', 
          reason: suspensionCheck.reason 
        });
        return;
      }

      const result = await this.connectionService.scheduleConnectionRequest(
        userId,
        targetProfileId,
        {
          message,
          templateId,
          priority,
          scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined
        }
      );

      if (result.success) {
        res.status(201).json({
          success: true,
          requestId: result.requestId,
          message: 'Connection request scheduled successfully'
        });
      } else {
        res.status(400).json({
          error: result.reason,
          retryAfter: result.retryAfter
        });
      }

    } catch (error) {
      console.error('Error scheduling connection:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  /**
   * Cancel a pending connection request
   */
  cancelConnection = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { requestId } = req.params;

      const result = await this.connectionService.cancelConnectionRequest(userId, requestId);

      if (result.success) {
        res.json({
          success: true,
          message: 'Connection request cancelled successfully'
        });
      } else {
        res.status(400).json({ error: result.reason });
      }

    } catch (error) {
      console.error('Error cancelling connection:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  /**
   * Get connection automation statistics
   */
  getConnectionStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const stats = await this.connectionService.getConnectionStats(userId);
      res.json(stats);

    } catch (error) {
      console.error('Error getting connection stats:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  // ===================================================================
  // ENGAGEMENT AUTOMATION ENDPOINTS  
  // ===================================================================

  /**
   * Schedule an engagement action (like, comment, view profile, follow)
   */
  scheduleEngagement = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { type, targetId, content, templateId, priority, metadata } = req.body;

      if (!type || !targetId) {
        res.status(400).json({ error: 'type and targetId are required' });
        return;
      }

      if (!['like', 'comment', 'view_profile', 'follow'].includes(type)) {
        res.status(400).json({ error: 'Invalid engagement type' });
        return;
      }

      // Check if automation is suspended
      const suspensionCheck = await this.safetyService.isUserAutomationSuspended(userId);
      if (suspensionCheck.suspended) {
        res.status(403).json({ 
          error: 'Automation suspended', 
          reason: suspensionCheck.reason 
        });
        return;
      }

      const result = await this.engagementService.scheduleEngagement(
        userId,
        type,
        targetId,
        {
          content,
          templateId,
          priority,
          metadata
        }
      );

      if (result.success) {
        res.status(201).json({
          success: true,
          taskId: result.taskId,
          score: result.score,
          message: 'Engagement scheduled successfully'
        });
      } else {
        res.status(400).json({
          error: result.reason,
          score: result.score,
          retryAfter: result.retryAfter
        });
      }

    } catch (error) {
      console.error('Error scheduling engagement:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  /**
   * Get engagement automation statistics
   */
  getEngagementStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const stats = await this.engagementService.getEngagementStats(userId);
      res.json(stats);

    } catch (error) {
      console.error('Error getting engagement stats:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  // ===================================================================
  // SAFETY MONITORING ENDPOINTS
  // ===================================================================

  /**
   * Start safety monitoring for a user
   */
  startSafetyMonitoring = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      await this.safetyService.startUserMonitoring(userId);

      res.json({
        success: true,
        message: 'Safety monitoring started'
      });

    } catch (error) {
      console.error('Error starting safety monitoring:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  /**
   * Stop safety monitoring for a user
   */
  stopSafetyMonitoring = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      await this.safetyService.stopUserMonitoring(userId);

      res.json({
        success: true,
        message: 'Safety monitoring stopped'
      });

    } catch (error) {
      console.error('Error stopping safety monitoring:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  /**
   * Get user safety status
   */
  getSafetyStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const status = await this.safetyService.performUserSafetyCheck(userId);
      res.json(status);

    } catch (error) {
      console.error('Error getting safety status:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  /**
   * Check if user automation is suspended
   */
  getAutomationStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const suspensionStatus = await this.safetyService.isUserAutomationSuspended(userId);
      
      res.json({
        automationEnabled: !suspensionStatus.suspended,
        suspended: suspensionStatus.suspended,
        reason: suspensionStatus.reason
      });

    } catch (error) {
      console.error('Error checking automation status:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  // ===================================================================
  // ADMIN ENDPOINTS (require admin role)
  // ===================================================================

  /**
   * Get safety dashboard for all users (admin only)
   */
  getSafetyDashboard = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      // Check admin role
      if (req.user?.role !== 'ADMIN' && req.user?.role !== 'SUPERADMIN') {
        res.status(403).json({ error: 'Admin access required' });
        return;
      }

      const dashboard = await this.safetyService.getSafetyDashboard();
      res.json(dashboard);

    } catch (error) {
      console.error('Error getting safety dashboard:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  /**
   * Resume automation for a user (admin only)
   */
  resumeUserAutomation = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      // Check admin role
      if (req.user?.role !== 'ADMIN' && req.user?.role !== 'SUPERADMIN') {
        res.status(403).json({ error: 'Admin access required' });
        return;
      }

      const { userId } = req.params;
      const adminId = req.user?.id;

      if (!userId || !adminId) {
        res.status(400).json({ error: 'userId is required' });
        return;
      }

      const result = await this.safetyService.resumeUserAutomation(userId, adminId);

      if (result.success) {
        res.json({
          success: true,
          message: 'User automation resumed successfully'
        });
      } else {
        res.status(400).json({ error: result.reason });
      }

    } catch (error) {
      console.error('Error resuming user automation:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  // ===================================================================
  // GENERAL AUTOMATION ENDPOINTS
  // ===================================================================

  /**
   * Get comprehensive automation overview for a user
   */
  getAutomationOverview = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const [connectionStats, engagementStats, safetyStatus, automationStatus] = await Promise.all([
        this.connectionService.getConnectionStats(userId),
        this.engagementService.getEngagementStats(userId),
        this.safetyService.performUserSafetyCheck(userId).catch(() => null),
        this.safetyService.isUserAutomationSuspended(userId)
      ]);

      res.json({
        automation: {
          enabled: !automationStatus.suspended,
          suspended: automationStatus.suspended,
          suspensionReason: automationStatus.reason
        },
        connections: connectionStats,
        engagement: engagementStats,
        safety: safetyStatus ? {
          status: safetyStatus.overallStatus,
          score: safetyStatus.score,
          activeAlertsCount: safetyStatus.activeAlerts.length,
          lastHealthCheck: safetyStatus.lastHealthCheck
        } : null
      });

    } catch (error) {
      console.error('Error getting automation overview:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  /**
   * Health check endpoint
   */
  healthCheck = async (req: Request, res: Response): Promise<void> => {
    try {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          connectionAutomation: 'operational',
          engagementAutomation: 'operational',
          safetyMonitoring: 'operational'
        }
      });
    } catch (error) {
      res.status(500).json({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };
}