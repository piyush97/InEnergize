// LinkedIn Compliance Middleware for Express.js
// Ensures all LinkedIn API requests comply with terms of service

import { Request, Response, NextFunction } from 'express';
import { LinkedInComplianceService } from '../services/compliance.service';
import { LinkedInAPIError } from '../types/linkedin';

interface LinkedInRequest extends Request {
  linkedinUserId?: string;
  linkedinEndpoint?: string;
  complianceData?: {
    allowed: boolean;
    reason?: string;
    retryAfter?: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  };
}

export class LinkedInComplianceMiddleware {
  private complianceService: LinkedInComplianceService;

  constructor(complianceService: LinkedInComplianceService) {
    this.complianceService = complianceService;
  }

  /**
   * Pre-request compliance validation middleware
   */
  validateRequest() {
    return async (req: LinkedInRequest, res: Response, next: NextFunction): Promise<void> => {
      try {
        // Extract user ID from various sources
        const userId = this.extractUserId(req);
        if (!userId) {
          res.status(401).json({
            error: 'User authentication required',
            code: 'LINKEDIN_AUTH_REQUIRED'
          });
          return;
        }

        // Determine LinkedIn endpoint being accessed
        const endpoint = this.extractEndpoint(req);
        
        // Validate request against compliance rules
        const validation = await this.complianceService.validateRequest(userId, endpoint);
        
        // Store compliance data for post-request logging
        req.linkedinUserId = userId;
        req.linkedinEndpoint = endpoint;
        req.complianceData = validation;

        if (!validation.allowed) {
          // Request not allowed due to compliance rules
          const statusCode = this.getStatusCodeForReason(validation.reason);
          
          const response: any = {
            error: validation.reason || 'Request not allowed',
            code: 'LINKEDIN_COMPLIANCE_VIOLATION',
            riskLevel: validation.riskLevel
          };

          if (validation.retryAfter) {
            response.retryAfter = validation.retryAfter;
            res.setHeader('Retry-After', validation.retryAfter.toString());
          }

          // Add rate limiting headers
          this.addRateLimitHeaders(res, userId);

          res.status(statusCode).json(response);
          return;
        }

        // Add delay for human-like behavior
        if (process.env.LINKEDIN_SAFE_MODE === 'true') {
          const delay = this.complianceService.generateHumanLikeDelay();
          await this.sleep(delay);
        }

        // Add compliance headers
        res.setHeader('X-LinkedIn-Compliance', 'true');
        res.setHeader('X-LinkedIn-Risk-Level', validation.riskLevel);
        
        next();
      } catch (error) {
        console.error('LinkedIn compliance validation error:', error);
        
        // In case of compliance service error, allow request but log
        if (process.env.LINKEDIN_SAFE_MODE === 'true') {
          res.status(503).json({
            error: 'Compliance service unavailable',
            code: 'LINKEDIN_COMPLIANCE_ERROR'
          });
          return;
        }
        
        next();
      }
    };
  }

  /**
   * Post-request logging middleware
   */
  logRequest() {
    return (req: LinkedInRequest, res: Response, next: NextFunction) => {
      // Capture original res.end to log after response
      const originalEnd = res.end;
      const startTime = Date.now();

      const originalEndBound = originalEnd.bind(res);
      res.end = function(...args: any[]): Response {
        const responseTime = Date.now() - startTime;
        
        // Log request to compliance service
        if (req.linkedinUserId && req.linkedinEndpoint) {
          const requestData = {
            userId: req.linkedinUserId,
            endpoint: req.linkedinEndpoint,
            method: req.method,
            statusCode: res.statusCode,
            responseTime,
            success: res.statusCode >= 200 && res.statusCode < 400,
            userAgent: req.get('User-Agent')
          };

          // Don't await to avoid delaying response
          setImmediate(() => {
            complianceService.logRequest(requestData).catch(error => {
              console.error('Failed to log LinkedIn request:', error);
            });
          });
        }

        // Call original end method with all arguments
        return originalEndBound(...args);
      } as any;

      next();
    };
  }

  /**
   * Rate limiting headers middleware
   */
  addRateLimitingHeaders() {
    return (req: LinkedInRequest, res: Response, next: NextFunction) => {
      if (req.linkedinUserId) {
        this.addRateLimitHeaders(res, req.linkedinUserId);
      }
      next();
    };
  }

  /**
   * Extract user ID from request
   */
  private extractUserId(req: Request): string | null {
    // Check various locations for user ID
    return (
      req.params.userId ||
      req.query.userId as string ||
      (req as any).user?.id ||
      (req as any).user?.sub ||
      req.get('X-User-ID') ||
      null
    );
  }

  /**
   * Extract LinkedIn endpoint from request
   */
  private extractEndpoint(req: Request): string {
    const baseEndpoint = req.route?.path || req.path;
    
    // Map internal routes to LinkedIn API endpoints
    const endpointMap: { [key: string]: string } = {
      '/profile': 'linkedin.profile',
      '/connections': 'linkedin.connections',
      '/posts': 'linkedin.posts',
      '/messages': 'linkedin.messages',
      '/search': 'linkedin.search'
    };

    // Find matching endpoint
    for (const [route, endpoint] of Object.entries(endpointMap)) {
      if (baseEndpoint.includes(route)) {
        return endpoint;
      }
    }

    return `linkedin.${baseEndpoint.replace(/[^a-zA-Z0-9]/g, '_')}`;
  }

  /**
   * Get appropriate HTTP status code for compliance reason
   */
  private getStatusCodeForReason(reason?: string): number {
    if (!reason) return 429;

    if (reason.includes('rate limit')) return 429;
    if (reason.includes('circuit breaker')) return 503;
    if (reason.includes('suspicious')) return 429;
    if (reason.includes('compliance')) return 422;

    return 429; // Default to rate limiting
  }

  /**
   * Add rate limiting headers to response
   */
  private addRateLimitHeaders(res: Response, userId: string): void {
    try {
      const metrics = this.complianceService.getComplianceMetrics(userId);
      
      // Add standard rate limiting headers
      res.setHeader('X-RateLimit-Limit-Day', metrics.dailyLimits.connectionRequests.limit);
      res.setHeader('X-RateLimit-Remaining-Day', metrics.dailyLimits.connectionRequests.remaining);
      
      // Add LinkedIn-specific headers
      res.setHeader('X-LinkedIn-Account-Health', metrics.accountHealth.score);
      res.setHeader('X-LinkedIn-Risk-Level', metrics.accountHealth.riskLevel);
      
      if (metrics.accountHealth.warnings.length > 0) {
        res.setHeader('X-LinkedIn-Warnings', metrics.accountHealth.warnings.join(', '));
      }
    } catch (error) {
      console.error('Failed to add rate limiting headers:', error);
    }
  }

  /**
   * Sleep utility for human-like delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Create singleton instance
const complianceService = new LinkedInComplianceService();
export const linkedinComplianceMiddleware = new LinkedInComplianceMiddleware(complianceService);

/**
 * Express middleware functions for easy use
 */
export const validateLinkedInRequest = linkedinComplianceMiddleware.validateRequest();
export const logLinkedInRequest = linkedinComplianceMiddleware.logRequest();
export const addLinkedInHeaders = linkedinComplianceMiddleware.addRateLimitingHeaders();

/**
 * Combined middleware for LinkedIn routes
 */
export const linkedinCompliance = [
  validateLinkedInRequest,
  addLinkedInHeaders,
  logLinkedInRequest
];

/**
 * LinkedIn compliance error handler middleware
 */
export const linkedinErrorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (error instanceof LinkedInAPIError) {
    const statusCode = error.statusCode || 500;
    
    res.status(statusCode).json({
      error: error.message,
      code: error.code,
      timestamp: new Date().toISOString(),
      requestId: req.get('X-Request-ID') || 'unknown'
    });
    
    return;
  }

  // Handle rate limiting errors
  if (error.status === 429 || error.code === 'RATE_LIMIT_EXCEEDED') {
    res.status(429).json({
      error: 'Rate limit exceeded',
      code: 'LINKEDIN_RATE_LIMIT',
      retryAfter: error.retryAfter || 3600,
      timestamp: new Date().toISOString()
    });
    
    return;
  }

  next(error);
};

/**
 * Compliance monitoring endpoint middleware
 */
export const complianceMonitoring = (req: Request, res: Response, next: NextFunction): void => {
  // Only allow access to compliance endpoints for admin users
  const userRole = (req as any).user?.role;
  
  if (userRole !== 'admin' && userRole !== 'superadmin') {
    res.status(403).json({
      error: 'Access denied - admin role required',
      code: 'LINKEDIN_COMPLIANCE_ACCESS_DENIED'
    });
    return;
  }

  next();
};

export { complianceService as linkedinComplianceService };