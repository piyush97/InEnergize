/**
 * Team Collaboration Permissions Testing Framework
 * 
 * Comprehensive testing for role-based access control, team data isolation,
 * and collaborative features security in InErgize Phase 4
 */

import { TeamPermissionService } from '../../services/user-service/src/services/teamPermission.service';
import { TeamService } from '../../services/user-service/src/services/team.service';
import { CollaborationService } from '../../services/user-service/src/services/collaboration.service';
import { 
  TeamRole, 
  Permission, 
  TeamMember, 
  CollaborationResource,
  TeamWorkspace,
  AccessControlList
} from '../../services/user-service/src/types/team';

// Mock dependencies
jest.mock('../../services/user-service/src/services/teamPermission.service');
jest.mock('../../services/user-service/src/services/team.service');
jest.mock('../../services/user-service/src/services/collaboration.service');

describe('Team Collaboration Permissions Testing', () => {
  let teamPermissionService: TeamPermissionService;
  let teamService: TeamService;
  let collaborationService: CollaborationService;

  // Role hierarchy and permissions matrix
  const ROLE_HIERARCHY = {
    OWNER: 100,
    ADMIN: 80,
    MANAGER: 60,
    MEMBER: 40,
    VIEWER: 20,
    GUEST: 10
  };

  const PERMISSION_MATRIX = {
    // User Management Permissions
    'users.create': ['OWNER', 'ADMIN'],
    'users.update': ['OWNER', 'ADMIN', 'MANAGER'],
    'users.delete': ['OWNER', 'ADMIN'],
    'users.view': ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'],
    'users.invite': ['OWNER', 'ADMIN', 'MANAGER'],
    
    // Team Management Permissions  
    'team.settings.update': ['OWNER', 'ADMIN'],
    'team.delete': ['OWNER'],
    'team.billing.view': ['OWNER', 'ADMIN'],
    'team.billing.update': ['OWNER'],
    'team.analytics.view': ['OWNER', 'ADMIN', 'MANAGER'],
    
    // LinkedIn Automation Permissions
    'automation.create': ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER'],
    'automation.update': ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER'],
    'automation.delete': ['OWNER', 'ADMIN', 'MANAGER'],
    'automation.view': ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'],
    'automation.execute': ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER'],
    'automation.approve': ['OWNER', 'ADMIN', 'MANAGER'],
    
    // Template Management Permissions
    'templates.create': ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER'],
    'templates.update.own': ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER'],
    'templates.update.any': ['OWNER', 'ADMIN', 'MANAGER'],
    'templates.delete.own': ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER'],
    'templates.delete.any': ['OWNER', 'ADMIN'],
    'templates.share': ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER'],
    
    // Analytics and Reporting Permissions
    'analytics.team.view': ['OWNER', 'ADMIN', 'MANAGER'],
    'analytics.individual.view': ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER'],
    'analytics.export': ['OWNER', 'ADMIN', 'MANAGER'],
    'reports.create': ['OWNER', 'ADMIN', 'MANAGER'],
    'reports.share': ['OWNER', 'ADMIN', 'MANAGER'],
    
    // Collaboration Permissions
    'collaboration.workspace.create': ['OWNER', 'ADMIN', 'MANAGER'],
    'collaboration.workspace.join': ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'],
    'collaboration.comments.create': ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER'],
    'collaboration.comments.delete.own': ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER'],
    'collaboration.comments.delete.any': ['OWNER', 'ADMIN', 'MANAGER'],
    
    // Compliance and Safety Permissions
    'compliance.view': ['OWNER', 'ADMIN', 'MANAGER'],
    'compliance.override': ['OWNER', 'ADMIN'],
    'safety.emergency_stop': ['OWNER', 'ADMIN'],
    'safety.limits.view': ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER'],
    
    // Data Access Permissions
    'data.export': ['OWNER', 'ADMIN'],
    'data.backup': ['OWNER'],
    'data.delete': ['OWNER']
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    teamPermissionService = new TeamPermissionService();
    teamService = new TeamService();
    collaborationService = new CollaborationService();
  });

  describe('Role-Based Access Control (RBAC)', () => {
    describe('Permission Matrix Validation', () => {
      it('should enforce correct permissions for each role level', async () => {
        const testTeam = await createTestTeam();
        const roles = Object.keys(ROLE_HIERARCHY) as TeamRole[];

        for (const role of roles) {
          const testUser = await createTestUser(role, testTeam.id);
          
          for (const [permission, allowedRoles] of Object.entries(PERMISSION_MATRIX)) {
            const hasPermission = await teamPermissionService.hasPermission(
              testUser.id,
              testTeam.id,
              permission as Permission
            );

            const shouldHavePermission = allowedRoles.includes(role);
            
            expect(hasPermission).toBe(shouldHavePermission);
            
            if (!shouldHavePermission && hasPermission) {
              throw new Error(
                `Permission violation: ${role} should not have ${permission} permission`
              );
            }
          }
        }
      });

      it('should prevent privilege escalation attacks', async () => {
        const testTeam = await createTestTeam();
        const memberUser = await createTestUser('MEMBER', testTeam.id);
        const viewerUser = await createTestUser('VIEWER', testTeam.id);

        // Attempt to escalate privileges through role modification
        const escalationAttempts = [
          // Member trying to become admin
          { 
            userId: memberUser.id, 
            attemptedRole: 'ADMIN',
            targetPermission: 'users.delete'
          },
          // Viewer trying to become manager
          { 
            userId: viewerUser.id, 
            attemptedRole: 'MANAGER',
            targetPermission: 'automation.delete'
          }
        ];

        for (const attempt of escalationAttempts) {
          // Mock attempt to modify user role directly
          jest.spyOn(teamPermissionService, 'updateUserRole')
            .mockRejectedValueOnce(new Error('Insufficient permissions'));

          await expect(
            teamPermissionService.updateUserRole(
              attempt.userId,
              testTeam.id,
              attempt.attemptedRole as TeamRole,
              attempt.userId // User trying to modify their own role
            )
          ).rejects.toThrow('Insufficient permissions');

          // Verify permission is still not granted
          const hasPermission = await teamPermissionService.hasPermission(
            attempt.userId,
            testTeam.id,
            attempt.targetPermission as Permission
          );

          expect(hasPermission).toBe(false);
        }
      });

      it('should implement hierarchical role inheritance correctly', async () => {
        const testTeam = await createTestTeam();
        
        // Create users with different role levels
        const ownerUser = await createTestUser('OWNER', testTeam.id);
        const adminUser = await createTestUser('ADMIN', testTeam.id);
        const managerUser = await createTestUser('MANAGER', testTeam.id);
        const memberUser = await createTestUser('MEMBER', testTeam.id);
        const viewerUser = await createTestUser('VIEWER', testTeam.id);

        // Test hierarchical inheritance
        const hierarchyTests = [
          {
            higherRole: ownerUser,
            lowerRole: adminUser,
            permission: 'team.settings.update'
          },
          {
            higherRole: adminUser,
            lowerRole: managerUser,
            permission: 'users.update'
          },
          {
            higherRole: managerUser,
            lowerRole: memberUser,
            permission: 'automation.approve'
          },
          {
            higherRole: memberUser,
            lowerRole: viewerUser,
            permission: 'automation.create'
          }
        ];

        for (const test of hierarchyTests) {
          const higherHasPermission = await teamPermissionService.hasPermission(
            test.higherRole.id,
            testTeam.id,
            test.permission as Permission
          );

          const lowerHasPermission = await teamPermissionService.hasPermission(
            test.lowerRole.id,
            testTeam.id,
            test.permission as Permission
          );

          // Higher role should have at least the same permissions as lower role
          if (lowerHasPermission) {
            expect(higherHasPermission).toBe(true);
          }
        }
      });
    });

    describe('Resource-Level Permissions', () => {
      it('should enforce ownership-based access control', async () => {
        const testTeam = await createTestTeam();
        const member1 = await createTestUser('MEMBER', testTeam.id);
        const member2 = await createTestUser('MEMBER', testTeam.id);
        const manager = await createTestUser('MANAGER', testTeam.id);

        // Create resources owned by different users
        const member1Template = await createTestTemplate(member1.id, testTeam.id);
        const member2Template = await createTestTemplate(member2.id, testTeam.id);

        // Test ownership-based access
        const ownershipTests = [
          {
            user: member1,
            resource: member1Template,
            permission: 'templates.update.own',
            shouldAllow: true
          },
          {
            user: member1,
            resource: member2Template,
            permission: 'templates.update.own',
            shouldAllow: false
          },
          {
            user: member2,
            resource: member1Template,
            permission: 'templates.delete.own',
            shouldAllow: false
          },
          {
            user: manager,
            resource: member1Template,
            permission: 'templates.update.any',
            shouldAllow: true
          },
          {
            user: manager,
            resource: member2Template,
            permission: 'templates.delete.any',
            shouldAllow: false // Manager can't delete any, only ADMIN/OWNER
          }
        ];

        for (const test of ownershipTests) {
          const hasAccess = await teamPermissionService.hasResourcePermission(
            test.user.id,
            testTeam.id,
            test.resource.id,
            test.permission as Permission
          );

          expect(hasAccess).toBe(test.shouldAllow);
        }
      });

      it('should handle shared resource permissions correctly', async () => {
        const testTeam = await createTestTeam();
        const owner = await createTestUser('OWNER', testTeam.id);
        const member1 = await createTestUser('MEMBER', testTeam.id);
        const member2 = await createTestUser('MEMBER', testTeam.id);
        const viewer = await createTestUser('VIEWER', testTeam.id);

        // Create shared workspace
        const sharedWorkspace = await createTestWorkspace(owner.id, testTeam.id);
        
        // Share workspace with specific members
        await collaborationService.shareResource(
          sharedWorkspace.id,
          [member1.id, member2.id],
          ['read', 'comment'],
          owner.id
        );

        // Test shared access permissions
        const member1CanRead = await teamPermissionService.hasResourcePermission(
          member1.id,
          testTeam.id,
          sharedWorkspace.id,
          'collaboration.workspace.join'
        );

        const member1CanComment = await teamPermissionService.hasResourcePermission(
          member1.id,
          testTeam.id,
          sharedWorkspace.id,
          'collaboration.comments.create'
        );

        const viewerCanRead = await teamPermissionService.hasResourcePermission(
          viewer.id,
          testTeam.id,
          sharedWorkspace.id,
          'collaboration.workspace.join'
        );

        expect(member1CanRead).toBe(true);
        expect(member1CanComment).toBe(true);
        expect(viewerCanRead).toBe(false); // Not explicitly shared
      });
    });

    describe('Dynamic Permission Updates', () => {
      it('should immediately reflect role changes across all permissions', async () => {
        const testTeam = await createTestTeam();
        const admin = await createTestUser('ADMIN', testTeam.id);
        const user = await createTestUser('MEMBER', testTeam.id);

        // Verify initial member permissions
        const initialDeletePermission = await teamPermissionService.hasPermission(
          user.id,
          testTeam.id,
          'automation.delete'
        );
        expect(initialDeletePermission).toBe(false);

        // Promote user to manager
        await teamPermissionService.updateUserRole(
          user.id,
          testTeam.id,
          'MANAGER',
          admin.id
        );

        // Verify updated permissions
        const updatedDeletePermission = await teamPermissionService.hasPermission(
          user.id,
          testTeam.id,
          'automation.delete'
        );
        expect(updatedDeletePermission).toBe(true);

        // Demote user back to member
        await teamPermissionService.updateUserRole(
          user.id,
          testTeam.id,
          'MEMBER',
          admin.id
        );

        // Verify permissions are revoked
        const finalDeletePermission = await teamPermissionService.hasPermission(
          user.id,
          testTeam.id,
          'automation.delete'
        );
        expect(finalDeletePermission).toBe(false);
      });

      it('should handle batch permission updates atomically', async () => {
        const testTeam = await createTestTeam();
        const admin = await createTestUser('ADMIN', testTeam.id);
        const users = await Promise.all([
          createTestUser('MEMBER', testTeam.id),
          createTestUser('MEMBER', testTeam.id),
          createTestUser('VIEWER', testTeam.id)
        ]);

        // Perform batch role update
        const roleUpdates = users.map(user => ({
          userId: user.id,
          newRole: 'MANAGER' as TeamRole
        }));

        await teamPermissionService.batchUpdateRoles(
          testTeam.id,
          roleUpdates,
          admin.id
        );

        // Verify all users have manager permissions
        for (const user of users) {
          const hasManagerPermission = await teamPermissionService.hasPermission(
            user.id,
            testTeam.id,
            'automation.approve'
          );
          expect(hasManagerPermission).toBe(true);
        }
      });
    });
  });

  describe('Data Isolation and Security', () => {
    describe('Multi-Tenant Data Isolation', () => {
      it('should prevent cross-team data access', async () => {
        // Create two separate teams
        const team1 = await createTestTeam('Team Alpha');
        const team2 = await createTestTeam('Team Beta');

        const team1Member = await createTestUser('MEMBER', team1.id);
        const team2Member = await createTestUser('MEMBER', team2.id);

        // Create team-specific resources
        const team1Template = await createTestTemplate(team1Member.id, team1.id);
        const team2Template = await createTestTemplate(team2Member.id, team2.id);

        // Attempt cross-team access
        const team1MemberCanAccessTeam2Template = await teamPermissionService.hasResourcePermission(
          team1Member.id,
          team1.id, // User's team
          team2Template.id, // Other team's resource
          'templates.view'
        );

        const team2MemberCanAccessTeam1Template = await teamPermissionService.hasResourcePermission(
          team2Member.id,
          team2.id, // User's team
          team1Template.id, // Other team's resource
          'templates.view'
        );

        expect(team1MemberCanAccessTeam2Template).toBe(false);
        expect(team2MemberCanAccessTeam1Template).toBe(false);
      });

      it('should isolate LinkedIn automation data by team', async () => {
        const team1 = await createTestTeam('Engineering Team');
        const team2 = await createTestTeam('Marketing Team');

        const engineer = await createTestUser('MEMBER', team1.id);
        const marketer = await createTestUser('MEMBER', team2.id);

        // Create team-specific automation campaigns
        const engineeringCampaign = await createTestAutomationCampaign(engineer.id, team1.id);
        const marketingCampaign = await createTestAutomationCampaign(marketer.id, team2.id);

        // Verify data isolation
        const engineerCanSeeMarketingCampaign = await teamPermissionService.hasResourcePermission(
          engineer.id,
          team1.id,
          marketingCampaign.id,
          'automation.view'
        );

        const marketerCanSeeEngineeringCampaign = await teamPermissionService.hasResourcePermission(
          marketer.id,
          team2.id,
          engineeringCampaign.id,
          'automation.view'
        );

        expect(engineerCanSeeMarketingCampaign).toBe(false);
        expect(marketerCanSeeEngineeringCampaign).toBe(false);

        // Verify team members can see their own team's data
        const engineerCanSeeEngineeringCampaign = await teamPermissionService.hasResourcePermission(
          engineer.id,
          team1.id,
          engineeringCampaign.id,
          'automation.view'
        );

        expect(engineerCanSeeEngineeringCampaign).toBe(true);
      });

      it('should isolate analytics and reporting data by team', async () => {
        const salesTeam = await createTestTeam('Sales Team');
        const hrTeam = await createTestTeam('HR Team');

        const salesManager = await createTestUser('MANAGER', salesTeam.id);
        const hrManager = await createTestUser('MANAGER', hrTeam.id);

        // Create team-specific analytics reports
        const salesReport = await createTestAnalyticsReport(salesManager.id, salesTeam.id);
        const hrReport = await createTestAnalyticsReport(hrManager.id, hrTeam.id);

        // Test cross-team analytics access
        const salesCanAccessHRAnalytics = await teamPermissionService.hasResourcePermission(
          salesManager.id,
          salesTeam.id,
          hrReport.id,
          'analytics.team.view'
        );

        const hrCanAccessSalesAnalytics = await teamPermissionService.hasResourcePermission(
          hrManager.id,
          hrTeam.id,
          salesReport.id,
          'analytics.team.view'
        );

        expect(salesCanAccessHRAnalytics).toBe(false);
        expect(hrCanAccessSalesAnalytics).toBe(false);
      });
    });

    describe('Personal Data Protection', () => {
      it('should protect individual LinkedIn data from team access', async () => {
        const team = await createTestTeam();
        const teamOwner = await createTestUser('OWNER', team.id);
        const teamMember = await createTestUser('MEMBER', team.id);

        // Create personal LinkedIn data
        const memberPersonalData = await createTestLinkedInProfile(teamMember.id);
        
        // Even team owner should not access member's personal LinkedIn data
        const ownerCanAccessMemberPersonalData = await teamPermissionService.hasResourcePermission(
          teamOwner.id,
          team.id,
          memberPersonalData.id,
          'linkedin.personal.view'
        );

        expect(ownerCanAccessMemberPersonalData).toBe(false);

        // Member should access their own data
        const memberCanAccessOwnData = await teamPermissionService.hasResourcePermission(
          teamMember.id,
          team.id,
          memberPersonalData.id,
          'linkedin.personal.view'
        );

        expect(memberCanAccessOwnData).toBe(true);
      });

      it('should allow controlled sharing of LinkedIn insights', async () => {
        const team = await createTestTeam();
        const member = await createTestUser('MEMBER', team.id);
        const manager = await createTestUser('MANAGER', team.id);

        const memberLinkedInInsights = await createTestLinkedInInsights(member.id, team.id);

        // Member explicitly shares insights with team
        await collaborationService.shareLinkedInInsights(
          memberLinkedInInsights.id,
          team.id,
          ['aggregated_metrics'], // Only aggregated data, not personal details
          member.id
        );

        // Manager can view shared insights
        const managerCanViewSharedInsights = await teamPermissionService.hasResourcePermission(
          manager.id,
          team.id,
          memberLinkedInInsights.id,
          'analytics.shared.view'
        );

        expect(managerCanViewSharedInsights).toBe(true);

        // But cannot access raw personal data
        const managerCanViewPersonalData = await teamPermissionService.hasResourcePermission(
          manager.id,
          team.id,
          memberLinkedInInsights.id,
          'linkedin.personal.view'
        );

        expect(managerCanViewPersonalData).toBe(false);
      });
    });

    describe('Secure Resource Sharing', () => {
      it('should enforce granular sharing permissions', async () => {
        const team = await createTestTeam();
        const owner = await createTestUser('OWNER', team.id);
        const manager = await createTestUser('MANAGER', team.id);
        const member1 = await createTestUser('MEMBER', team.id);
        const member2 = await createTestUser('MEMBER', team.id);
        const viewer = await createTestUser('VIEWER', team.id);

        // Create a sensitive template
        const sensitiveTemplate = await createTestTemplate(owner.id, team.id, {
          sensitivity: 'high',
          containsPII: true
        });

        // Share with specific permissions
        await collaborationService.shareResource(
          sensitiveTemplate.id,
          [manager.id], // Only manager gets full access
          ['read', 'comment', 'edit'],
          owner.id
        );

        await collaborationService.shareResource(
          sensitiveTemplate.id,
          [member1.id], // Member gets limited access
          ['read', 'comment'],
          owner.id
        );

        // Test access levels
        const managerCanEdit = await teamPermissionService.hasResourcePermission(
          manager.id,
          team.id,
          sensitiveTemplate.id,
          'templates.update.shared'
        );

        const member1CanEdit = await teamPermissionService.hasResourcePermission(
          member1.id,
          team.id,
          sensitiveTemplate.id,
          'templates.update.shared'
        );

        const member2CanView = await teamPermissionService.hasResourcePermission(
          member2.id,
          team.id,
          sensitiveTemplate.id,
          'templates.view'
        );

        const viewerCanView = await teamPermissionService.hasResourcePermission(
          viewer.id,
          team.id,
          sensitiveTemplate.id,
          'templates.view'
        );

        expect(managerCanEdit).toBe(true);
        expect(member1CanEdit).toBe(false);
        expect(member2CanView).toBe(false); // Not shared with member2
        expect(viewerCanView).toBe(false); // Not shared with viewer
      });

      it('should support time-limited access grants', async () => {
        const team = await createTestTeam();
        const owner = await createTestUser('OWNER', team.id);
        const contractor = await createTestUser('MEMBER', team.id);

        const projectTemplate = await createTestTemplate(owner.id, team.id);

        // Grant temporary access (expires in 1 hour)
        const expirationTime = new Date(Date.now() + 60 * 60 * 1000);
        await collaborationService.shareResourceWithExpiration(
          projectTemplate.id,
          [contractor.id],
          ['read', 'comment'],
          expirationTime,
          owner.id
        );

        // Verify access is granted initially
        const initialAccess = await teamPermissionService.hasResourcePermission(
          contractor.id,
          team.id,
          projectTemplate.id,
          'templates.view'
        );
        expect(initialAccess).toBe(true);

        // Mock time passage (after expiration)
        jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 2 * 60 * 60 * 1000);

        // Verify access is revoked after expiration
        const expiredAccess = await teamPermissionService.hasResourcePermission(
          contractor.id,
          team.id,
          projectTemplate.id,
          'templates.view'
        );
        expect(expiredAccess).toBe(false);

        jest.restoreAllMocks();
      });
    });
  });

  describe('Permission Audit and Compliance', () => {
    describe('Audit Trail Generation', () => {
      it('should log all permission changes with complete audit trail', async () => {
        const team = await createTestTeam();
        const admin = await createTestUser('ADMIN', team.id);
        const user = await createTestUser('MEMBER', team.id);

        // Mock audit logging
        const auditSpy = jest.spyOn(teamPermissionService, 'logAuditEvent');

        // Perform various permission changes
        await teamPermissionService.updateUserRole(user.id, team.id, 'MANAGER', admin.id);
        await teamPermissionService.revokeUserAccess(user.id, team.id, admin.id);
        await teamPermissionService.restoreUserAccess(user.id, team.id, admin.id);

        // Verify audit events were logged
        expect(auditSpy).toHaveBeenCalledWith({
          eventType: 'role_updated',
          userId: user.id,
          teamId: team.id,
          performedBy: admin.id,
          oldValue: 'MEMBER',
          newValue: 'MANAGER',
          timestamp: expect.any(Date),
          ipAddress: expect.any(String),
          userAgent: expect.any(String)
        });

        expect(auditSpy).toHaveBeenCalledWith({
          eventType: 'access_revoked',
          userId: user.id,
          teamId: team.id,
          performedBy: admin.id,
          reason: 'Manual revocation',
          timestamp: expect.any(Date)
        });

        expect(auditSpy).toHaveBeenCalledWith({
          eventType: 'access_restored',
          userId: user.id,
          teamId: team.id,
          performedBy: admin.id,
          timestamp: expect.any(Date)
        });
      });

      it('should generate comprehensive access reports', async () => {
        const team = await createTestTeam();
        const users = await Promise.all([
          createTestUser('OWNER', team.id),
          createTestUser('ADMIN', team.id),
          createTestUser('MANAGER', team.id),
          createTestUser('MEMBER', team.id),
          createTestUser('VIEWER', team.id)
        ]);

        // Generate access report
        const accessReport = await teamPermissionService.generateAccessReport(team.id);

        expect(accessReport).toEqual({
          teamId: team.id,
          generatedAt: expect.any(Date),
          totalUsers: 5,
          roleDistribution: {
            OWNER: 1,
            ADMIN: 1,
            MANAGER: 1,
            MEMBER: 1,
            VIEWER: 1
          },
          permissionsSummary: expect.objectContaining({
            'users.create': 2, // OWNER + ADMIN
            'users.delete': 2, // OWNER + ADMIN
            'automation.create': 4, // OWNER + ADMIN + MANAGER + MEMBER
            'analytics.team.view': 3 // OWNER + ADMIN + MANAGER
          }),
          riskAssessment: {
            highPrivilegeUsers: 2, // OWNER + ADMIN
            sharedResourceCount: expect.any(Number),
            lastPermissionChange: expect.any(Date)
          }
        });
      });
    });

    describe('Compliance Monitoring', () => {
      it('should monitor for permission anomalies', async () => {
        const team = await createTestTeam();
        const owner = await createTestUser('OWNER', team.id);
        const user = await createTestUser('VIEWER', team.id);

        // Simulate suspicious activity
        const suspiciousActivities = [
          // Multiple rapid role changes
          { action: 'updateRole', from: 'VIEWER', to: 'ADMIN', timestamp: new Date() },
          { action: 'updateRole', from: 'ADMIN', to: 'VIEWER', timestamp: new Date(Date.now() + 1000) },
          { action: 'updateRole', from: 'VIEWER', to: 'MANAGER', timestamp: new Date(Date.now() + 2000) },
        ];

        // Mock the activities
        for (const activity of suspiciousActivities) {
          await teamPermissionService.updateUserRole(
            user.id,
            team.id,
            activity.to as TeamRole,
            owner.id
          );
        }

        // Check for anomalies
        const anomalies = await teamPermissionService.detectPermissionAnomalies(team.id);

        expect(anomalies).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              type: 'rapid_role_changes',
              userId: user.id,
              severity: 'high',
              description: expect.stringContaining('Multiple role changes'),
              detectedAt: expect.any(Date)
            })
          ])
        );
      });

      it('should enforce principle of least privilege', async () => {
        const team = await createTestTeam();
        const admin = await createTestUser('ADMIN', team.id);

        // Create user with minimal required permissions
        const restrictedUser = await teamPermissionService.createUserWithMinimalPermissions(
          team.id,
          {
            email: 'restricted@example.com',
            requiredPermissions: ['automation.view', 'templates.view']
          },
          admin.id
        );

        // Verify user has only required permissions
        const userPermissions = await teamPermissionService.getUserPermissions(
          restrictedUser.id,
          team.id
        );

        const allowedPermissions = userPermissions.filter(p => p.granted);
        const requiredPermissions = ['automation.view', 'templates.view'];

        // User should have the required permissions
        for (const permission of requiredPermissions) {
          expect(allowedPermissions.some(p => p.permission === permission)).toBe(true);
        }

        // User should not have elevated permissions
        const elevatedPermissions = ['users.delete', 'team.settings.update', 'data.export'];
        for (const permission of elevatedPermissions) {
          expect(allowedPermissions.some(p => p.permission === permission)).toBe(false);
        }
      });
    });
  });

  describe('Integration with LinkedIn Compliance', () => {
    describe('Team-Level LinkedIn Compliance', () => {
      it('should aggregate LinkedIn compliance across team members', async () => {
        const team = await createTestTeam();
        const members = await Promise.all([
          createTestUser('MEMBER', team.id),
          createTestUser('MEMBER', team.id),
          createTestUser('MEMBER', team.id)
        ]);

        // Mock individual LinkedIn compliance scores
        const mockLinkedInCompliance = jest.fn()
          .mockResolvedValueOnce({ score: 85, status: 'compliant' })
          .mockResolvedValueOnce({ score: 72, status: 'warning' })
          .mockResolvedValueOnce({ score: 45, status: 'violation' });

        // Calculate team compliance
        const teamCompliance = await teamPermissionService.calculateTeamLinkedInCompliance(
          team.id,
          mockLinkedInCompliance
        );

        expect(teamCompliance).toEqual({
          teamId: team.id,
          averageScore: 67.33,
          memberBreakdown: {
            compliant: 1,
            warning: 1,
            violation: 1
          },
          teamStatus: 'warning', // Team status based on lowest member
          recommendedActions: expect.arrayContaining([
            expect.stringContaining('Review member with violation status')
          ])
        });
      });

      it('should enforce team-wide LinkedIn safety limits', async () => {
        const team = await createTestTeam();
        const members = await Promise.all([
          createTestUser('MEMBER', team.id),
          createTestUser('MEMBER', team.id)
        ]);

        // Mock team approaching LinkedIn limits
        const teamLinkedInUsage = {
          totalDailyConnections: 25, // Team total
          individualLimits: {
            [members[0].id]: 15, // At individual limit
            [members[1].id]: 10  // Within individual limit
          },
          teamLimit: 30 // Team daily limit
        };

        const canMakeConnection = await teamPermissionService.checkTeamLinkedInLimits(
          team.id,
          members[0].id,
          'connection_request'
        );

        expect(canMakeConnection).toEqual({
          allowed: false,
          reason: 'Individual daily limit reached',
          retryAfter: expect.any(Number),
          teamStatus: {
            usage: 25,
            limit: 30,
            percentage: 83.33
          }
        });
      });
    });
  });

  // Test helper functions
  async function createTestTeam(name = 'Test Team'): Promise<any> {
    return {
      id: 'team-' + Math.random().toString(36).substr(2, 9),
      name,
      createdAt: new Date(),
      settings: {
        linkedinLimits: {
          dailyConnectionsPerMember: 15,
          dailyTeamConnections: 100
        }
      }
    };
  }

  async function createTestUser(role: TeamRole, teamId: string): Promise<any> {
    return {
      id: 'user-' + Math.random().toString(36).substr(2, 9),
      email: `user-${Math.random().toString(36).substr(2, 5)}@example.com`,
      role,
      teamId,
      joinedAt: new Date()
    };
  }

  async function createTestTemplate(ownerId: string, teamId: string, options: any = {}): Promise<any> {
    return {
      id: 'template-' + Math.random().toString(36).substr(2, 9),
      ownerId,
      teamId,
      name: 'Test Template',
      type: 'connection_request',
      sensitivity: options.sensitivity || 'normal',
      containsPII: options.containsPII || false,
      createdAt: new Date()
    };
  }

  async function createTestWorkspace(ownerId: string, teamId: string): Promise<any> {
    return {
      id: 'workspace-' + Math.random().toString(36).substr(2, 9),
      ownerId,
      teamId,
      name: 'Test Workspace',
      type: 'collaboration',
      createdAt: new Date()
    };
  }

  async function createTestAutomationCampaign(ownerId: string, teamId: string): Promise<any> {
    return {
      id: 'campaign-' + Math.random().toString(36).substr(2, 9),
      ownerId,
      teamId,
      name: 'Test Campaign',
      type: 'connection_automation',
      createdAt: new Date()
    };
  }

  async function createTestAnalyticsReport(ownerId: string, teamId: string): Promise<any> {
    return {
      id: 'report-' + Math.random().toString(36).substr(2, 9),
      ownerId,
      teamId,
      name: 'Test Analytics Report',
      type: 'team_performance',
      createdAt: new Date()
    };
  }

  async function createTestLinkedInProfile(userId: string): Promise<any> {
    return {
      id: 'profile-' + Math.random().toString(36).substr(2, 9),
      userId,
      linkedinId: 'linkedin-' + Math.random().toString(36).substr(2, 9),
      personalData: {
        name: 'Test Name',
        headline: 'Test Headline',
        connections: 500
      },
      createdAt: new Date()
    };
  }

  async function createTestLinkedInInsights(userId: string, teamId: string): Promise<any> {
    return {
      id: 'insights-' + Math.random().toString(36).substr(2, 9),
      userId,
      teamId,
      aggregatedMetrics: {
        profileViews: 150,
        searchAppearances: 75,
        postEngagement: 25
      },
      personalDetails: {
        connections: 500,
        messages: 10,
        endorsements: 25
      },
      createdAt: new Date()
    };
  }
});

// Permission testing utilities
export class PermissionTestUtils {
  static async verifyPermissionMatrix(
    service: TeamPermissionService,
    userId: string,
    teamId: string,
    expectedPermissions: { [permission: string]: boolean }
  ): Promise<void> {
    for (const [permission, expected] of Object.entries(expectedPermissions)) {
      const actual = await service.hasPermission(userId, teamId, permission as Permission);
      if (actual !== expected) {
        throw new Error(
          `Permission mismatch for ${permission}: expected ${expected}, got ${actual}`
        );
      }
    }
  }

  static generateRoleTestMatrix(): { [role: string]: Permission[] } {
    const matrix: { [role: string]: Permission[] } = {};
    
    for (const [permission, roles] of Object.entries(PERMISSION_MATRIX)) {
      for (const role of roles) {
        if (!matrix[role]) {
          matrix[role] = [];
        }
        matrix[role].push(permission as Permission);
      }
    }
    
    return matrix;
  }

  static async simulatePrivilegeEscalation(
    service: TeamPermissionService,
    attackerUserId: string,
    targetUserId: string,
    teamId: string
  ): Promise<boolean> {
    try {
      // Attempt various privilege escalation attacks
      await service.updateUserRole(targetUserId, teamId, 'OWNER', attackerUserId);
      return true; // Escalation succeeded (security vulnerability)
    } catch {
      return false; // Escalation prevented (correct behavior)
    }
  }
}