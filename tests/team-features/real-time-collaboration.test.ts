/**
 * Real-Time Collaboration Testing Framework
 * 
 * Comprehensive testing for WebSocket-based real-time features, concurrent editing,
 * and collaborative workflows in InErgize Phase 4
 */

import { WebSocketTestServer } from '../utils/websocket-test-server';
import { CollaborationService } from '../../services/user-service/src/services/collaboration.service';
import { WebSocketService } from '../../services/websocket-service/src/services/websocket.service';
import { RealTimeTemplateService } from '../../services/user-service/src/services/realTimeTemplate.service';
import { 
  CollaborationEvent,
  WebSocketMessage,
  TemplateEditSession,
  ConcurrentEdit,
  ConflictResolution
} from '../../services/websocket-service/src/types/collaboration';

// Mock WebSocket dependencies
jest.mock('ws');
jest.mock('ioredis');

describe('Real-Time Collaboration Testing', () => {
  let wsTestServer: WebSocketTestServer;
  let collaborationService: CollaborationService;
  let websocketService: WebSocketService;
  let realTimeTemplateService: RealTimeTemplateService;

  // Test configuration
  const TEST_CONFIG = {
    MAX_CONCURRENT_USERS: 50,
    MESSAGE_LATENCY_THRESHOLD: 100, // ms
    CONFLICT_RESOLUTION_THRESHOLD: 500, // ms
    SESSION_TIMEOUT: 30000, // 30 seconds
    HEARTBEAT_INTERVAL: 5000, // 5 seconds
    MAX_EDIT_HISTORY: 100
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Initialize test WebSocket server
    wsTestServer = new WebSocketTestServer();
    await wsTestServer.start();

    collaborationService = new CollaborationService();
    websocketService = new WebSocketService();
    realTimeTemplateService = new RealTimeTemplateService();
  });

  afterEach(async () => {
    await wsTestServer.stop();
  });

  describe('WebSocket Connection Management', () => {
    describe('Connection Establishment', () => {
      it('should establish WebSocket connections with proper authentication', async () => {
        const testUser = await createTestUser();
        const testTeam = await createTestTeam();
        
        // Connect user to WebSocket
        const client = await wsTestServer.createClient({
          userId: testUser.id,
          teamId: testTeam.id,
          token: generateTestJWT(testUser.id)
        });

        await client.connect();

        // Verify connection was established
        expect(client.isConnected).toBe(true);
        expect(client.userId).toBe(testUser.id);
        expect(client.teamId).toBe(testTeam.id);

        // Verify server received connection
        const connectedClients = await wsTestServer.getConnectedClients();
        expect(connectedClients).toHaveLength(1);
        expect(connectedClients[0].userId).toBe(testUser.id);
      });

      it('should reject connections with invalid authentication', async () => {
        const invalidTokens = [
          'invalid-token',
          'expired-token',
          '',
          null,
          generateExpiredJWT('user-123')
        ];

        for (const token of invalidTokens) {
          const client = await wsTestServer.createClient({
            userId: 'test-user',
            teamId: 'test-team',
            token
          });

          await expect(client.connect()).rejects.toThrow(/authentication failed/i);
          expect(client.isConnected).toBe(false);
        }
      });

      it('should handle multiple concurrent connections per user', async () => {
        const testUser = await createTestUser();
        const testTeam = await createTestTeam();
        const validToken = generateTestJWT(testUser.id);

        // Connect same user from multiple devices/tabs
        const connections = await Promise.all([
          wsTestServer.createClient({ 
            userId: testUser.id,
            teamId: testTeam.id,
            token: validToken,
            deviceId: 'desktop-browser'
          }),
          wsTestServer.createClient({ 
            userId: testUser.id,
            teamId: testTeam.id,
            token: validToken,
            deviceId: 'mobile-app'
          }),
          wsTestServer.createClient({ 
            userId: testUser.id,
            teamId: testTeam.id,
            token: validToken,
            deviceId: 'tablet-app'
          })
        ]);

        // Connect all clients
        await Promise.all(connections.map(client => client.connect()));

        // Verify all connections are active
        connections.forEach(client => {
          expect(client.isConnected).toBe(true);
        });

        const connectedClients = await wsTestServer.getConnectedClients();
        expect(connectedClients).toHaveLength(3);
        
        // All should have same userId but different deviceIds
        const userConnections = connectedClients.filter(c => c.userId === testUser.id);
        expect(userConnections).toHaveLength(3);
        
        const deviceIds = userConnections.map(c => c.deviceId);
        expect(deviceIds).toEqual(expect.arrayContaining([
          'desktop-browser',
          'mobile-app', 
          'tablet-app'
        ]));
      });
    });

    describe('Connection Lifecycle Management', () => {
      it('should handle graceful disconnections', async () => {
        const testUser = await createTestUser();
        const testTeam = await createTestTeam();

        const client = await wsTestServer.createClient({
          userId: testUser.id,
          teamId: testTeam.id,
          token: generateTestJWT(testUser.id)
        });

        await client.connect();
        expect(client.isConnected).toBe(true);

        // Graceful disconnect
        await client.disconnect();
        expect(client.isConnected).toBe(false);

        // Verify server cleaned up connection
        const connectedClients = await wsTestServer.getConnectedClients();
        expect(connectedClients).toHaveLength(0);
      });

      it('should handle connection drops and automatic reconnection', async () => {
        const testUser = await createTestUser();
        const testTeam = await createTestTeam();

        const client = await wsTestServer.createClient({
          userId: testUser.id,
          teamId: testTeam.id,
          token: generateTestJWT(testUser.id),
          autoReconnect: true
        });

        await client.connect();
        expect(client.isConnected).toBe(true);

        // Simulate connection drop
        await client.simulateConnectionDrop();
        expect(client.isConnected).toBe(false);

        // Wait for automatic reconnection
        await client.waitForReconnection(5000);
        expect(client.isConnected).toBe(true);

        // Verify reconnection maintained session state
        const sessionData = await client.getSessionData();
        expect(sessionData.userId).toBe(testUser.id);
        expect(sessionData.teamId).toBe(testTeam.id);
      });

      it('should implement heartbeat mechanism for connection health', async () => {
        const testUser = await createTestUser();
        const testTeam = await createTestTeam();

        const client = await wsTestServer.createClient({
          userId: testUser.id,
          teamId: testTeam.id,
          token: generateTestJWT(testUser.id)
        });

        await client.connect();

        // Monitor heartbeat messages
        const heartbeats: Date[] = [];
        client.onMessage((message: WebSocketMessage) => {
          if (message.type === 'heartbeat') {
            heartbeats.push(new Date());
          }
        });

        // Wait for multiple heartbeats
        await new Promise(resolve => setTimeout(resolve, 15000)); // 15 seconds

        // Verify heartbeats were received at regular intervals
        expect(heartbeats.length).toBeGreaterThan(2);
        
        const intervals = heartbeats.slice(1).map((beat, i) => 
          beat.getTime() - heartbeats[i].getTime()
        );
        
        intervals.forEach(interval => {
          expect(interval).toBeGreaterThan(4000); // At least 4 seconds
          expect(interval).toBeLessThan(6000); // At most 6 seconds
        });
      });
    });

    describe('Connection Scaling and Performance', () => {
      it('should handle 50+ concurrent connections efficiently', async () => {
        const testTeam = await createTestTeam();
        const concurrentUsers = 50;
        
        // Create test users
        const users = await Promise.all(
          Array(concurrentUsers).fill(null).map(() => createTestUser())
        );

        // Create connections for all users
        const clients = await Promise.all(
          users.map(user => 
            wsTestServer.createClient({
              userId: user.id,
              teamId: testTeam.id,
              token: generateTestJWT(user.id)
            })
          )
        );

        const startTime = Date.now();

        // Connect all clients simultaneously
        await Promise.all(clients.map(client => client.connect()));

        const connectionTime = Date.now() - startTime;

        // Verify all connections succeeded
        const connectedClients = await wsTestServer.getConnectedClients();
        expect(connectedClients).toHaveLength(concurrentUsers);

        // Performance assertion: should connect 50 users in under 5 seconds
        expect(connectionTime).toBeLessThan(5000);

        // Test message broadcast performance
        const broadcastStartTime = Date.now();
        const testMessage = {
          type: 'team_notification',
          data: { message: 'Test broadcast to all users' },
          teamId: testTeam.id
        };

        await wsTestServer.broadcastToTeam(testTeam.id, testMessage);

        // Verify all clients received the message
        const messageReceipts = await Promise.all(
          clients.map(client => client.waitForMessage('team_notification', 1000))
        );

        const broadcastTime = Date.now() - broadcastStartTime;

        messageReceipts.forEach(receipt => {
          expect(receipt).toBeDefined();
          expect(receipt.data.message).toBe('Test broadcast to all users');
        });

        // Performance assertion: broadcast to 50 users in under 1 second
        expect(broadcastTime).toBeLessThan(1000);

        console.log(`Performance test results:`, {
          concurrentConnections: concurrentUsers,
          connectionTime: `${connectionTime}ms`,
          broadcastTime: `${broadcastTime}ms`
        });
      });

      it('should maintain low latency for real-time messages', async () => {
        const testUsers = await Promise.all([
          createTestUser(),
          createTestUser()
        ]);
        const testTeam = await createTestTeam();

        const [client1, client2] = await Promise.all(
          testUsers.map(user =>
            wsTestServer.createClient({
              userId: user.id,
              teamId: testTeam.id,
              token: generateTestJWT(user.id)
            })
          )
        );

        await Promise.all([client1.connect(), client2.connect()]);

        // Measure message round-trip latency
        const latencies: number[] = [];
        const testCount = 10;

        for (let i = 0; i < testCount; i++) {
          const startTime = Date.now();
          
          // Client 1 sends message
          const testMessage = {
            type: 'template_edit',
            data: { 
              templateId: 'test-template',
              edit: { type: 'insert', position: i, content: `Test ${i}` }
            },
            timestamp: startTime
          };

          client1.send(testMessage);

          // Client 2 receives message
          const receivedMessage = await client2.waitForMessage('template_edit', 2000);
          const latency = Date.now() - startTime;
          
          latencies.push(latency);
          
          expect(receivedMessage).toBeDefined();
          expect(receivedMessage.data.edit.content).toBe(`Test ${i}`);
        }

        // Calculate latency statistics
        const avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
        const maxLatency = Math.max(...latencies);
        const p95Latency = latencies.sort()[Math.floor(latencies.length * 0.95)];

        // Performance assertions
        expect(avgLatency).toBeLessThan(TEST_CONFIG.MESSAGE_LATENCY_THRESHOLD);
        expect(maxLatency).toBeLessThan(TEST_CONFIG.MESSAGE_LATENCY_THRESHOLD * 2);
        expect(p95Latency).toBeLessThan(TEST_CONFIG.MESSAGE_LATENCY_THRESHOLD * 1.5);

        console.log(`Latency test results:`, {
          averageLatency: `${avgLatency.toFixed(2)}ms`,
          maxLatency: `${maxLatency}ms`,
          p95Latency: `${p95Latency}ms`
        });
      });
    });
  });

  describe('Concurrent Template Editing', () => {
    describe('Operational Transformation', () => {
      it('should handle concurrent text edits with operational transformation', async () => {
        const testUsers = await Promise.all([
          createTestUser('Editor 1'),
          createTestUser('Editor 2')
        ]);
        const testTeam = await createTestTeam();
        const testTemplate = await createTestTemplate(testUsers[0].id, testTeam.id);

        // Connect both editors
        const [editor1, editor2] = await Promise.all(
          testUsers.map(user =>
            wsTestServer.createClient({
              userId: user.id,
              teamId: testTeam.id,
              token: generateTestJWT(user.id)
            })
          )
        );

        await Promise.all([editor1.connect(), editor2.connect()]);

        // Both editors join the same template editing session
        await Promise.all([
          editor1.send({
            type: 'join_edit_session',
            data: { templateId: testTemplate.id }
          }),
          editor2.send({
            type: 'join_edit_session',
            data: { templateId: testTemplate.id }
          })
        ]);

        // Initial template content
        const initialContent = "Hello, I'm interested in connecting.";
        
        // Simulate concurrent edits
        const concurrentEdits = [
          // Editor 1 inserts at position 7
          {
            editor: editor1,
            operation: {
              type: 'insert',
              position: 7,
              content: 'there! ',
              timestamp: Date.now()
            }
          },
          // Editor 2 replaces "interested" with "excited" (positions 11-21)
          {
            editor: editor2,
            operation: {
              type: 'replace',
              start: 11,
              end: 21,
              content: 'excited',
              timestamp: Date.now() + 10 // Slightly later
            }
          }
        ];

        // Send concurrent edits
        await Promise.all(
          concurrentEdits.map(edit =>
            edit.editor.send({
              type: 'template_edit',
              data: {
                templateId: testTemplate.id,
                operation: edit.operation
              }
            })
          )
        );

        // Wait for operational transformation to resolve
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Get final content from both editors
        const [finalContent1, finalContent2] = await Promise.all([
          editor1.send({ type: 'get_template_content', data: { templateId: testTemplate.id } }),
          editor2.send({ type: 'get_template_content', data: { templateId: testTemplate.id } })
        ]);

        // Both editors should have the same final content
        expect(finalContent1.content).toBe(finalContent2.content);
        
        // Expected result after operational transformation:
        // "Hello, there! I'm excited in connecting."
        const expectedContent = "Hello, there! I'm excited in connecting.";
        expect(finalContent1.content).toBe(expectedContent);
      });

      it('should resolve complex multi-user edit conflicts', async () => {
        const editors = await Promise.all([
          createTestUser('Editor 1'),
          createTestUser('Editor 2'),
          createTestUser('Editor 3')
        ]);
        const testTeam = await createTestTeam();
        const testTemplate = await createTestTemplate(editors[0].id, testTeam.id);

        // Connect all editors
        const clients = await Promise.all(
          editors.map(user =>
            wsTestServer.createClient({
              userId: user.id,
              teamId: testTeam.id,
              token: generateTestJWT(user.id)
            })
          )
        );

        await Promise.all(clients.map(client => client.connect()));

        // All editors join the same template
        await Promise.all(
          clients.map(client =>
            client.send({
              type: 'join_edit_session',
              data: { templateId: testTemplate.id }
            })
          )
        );

        // Complex concurrent editing scenario
        const complexEdits = [
          // Editor 1: Insert at beginning
          {
            client: clients[0],
            operation: {
              type: 'insert',
              position: 0,
              content: 'Hi there! ',
              userId: editors[0].id
            }
          },
          // Editor 2: Insert in middle
          {
            client: clients[1],
            operation: {
              type: 'insert',
              position: 15,
              content: ' professional',
              userId: editors[1].id
            }
          },
          // Editor 3: Replace at end
          {
            client: clients[2],
            operation: {
              type: 'replace',
              start: 25,
              end: 35,
              content: 'collaborating',
              userId: editors[2].id
            }
          }
        ];

        // Execute all edits simultaneously
        const editPromises = complexEdits.map(edit =>
          edit.client.send({
            type: 'template_edit',
            data: {
              templateId: testTemplate.id,
              operation: edit.operation
            }
          })
        );

        await Promise.all(editPromises);

        // Wait for conflict resolution
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Verify all clients have consistent final state
        const finalContents = await Promise.all(
          clients.map(client =>
            client.send({
              type: 'get_template_content',
              data: { templateId: testTemplate.id }
            })
          )
        );

        // All editors should see the same final content
        const content = finalContents[0].content;
        finalContents.forEach(result => {
          expect(result.content).toBe(content);
        });

        // Verify edit history is maintained
        const editHistory = await realTimeTemplateService.getEditHistory(testTemplate.id);
        expect(editHistory.operations).toHaveLength(3);
        expect(editHistory.contributors).toEqual(
          expect.arrayContaining(editors.map(e => e.id))
        );
      });
    });

    describe('Conflict Detection and Resolution', () => {
      it('should detect and resolve conflicting edits within latency threshold', async () => {
        const [editor1, editor2] = await Promise.all([
          createTestUser('Fast Editor'),
          createTestUser('Slow Editor')
        ]);
        const testTeam = await createTestTeam();
        const testTemplate = await createTestTemplate(editor1.id, testTeam.id);

        const [client1, client2] = await Promise.all([
          wsTestServer.createClient({
            userId: editor1.id,
            teamId: testTeam.id,
            token: generateTestJWT(editor1.id)
          }),
          wsTestServer.createClient({
            userId: editor2.id,
            teamId: testTeam.id,
            token: generateTestJWT(editor2.id)
          })
        ]);

        await Promise.all([client1.connect(), client2.connect()]);

        // Both join template editing
        await Promise.all([
          client1.send({ type: 'join_edit_session', data: { templateId: testTemplate.id } }),
          client2.send({ type: 'join_edit_session', data: { templateId: testTemplate.id } })
        ]);

        const conflictStartTime = Date.now();

        // Create conflicting edits (same position, different content)
        const conflictingEdits = [
          {
            client: client1,
            operation: {
              type: 'replace',
              start: 10,
              end: 20,
              content: 'collaboration',
              timestamp: Date.now()
            }
          },
          {
            client: client2,
            operation: {
              type: 'replace',
              start: 10,
              end: 20,
              content: 'partnership',
              timestamp: Date.now() + 50 // 50ms later
            }
          }
        ];

        // Send conflicting edits
        await Promise.all(
          conflictingEdits.map(edit =>
            edit.client.send({
              type: 'template_edit',
              data: {
                templateId: testTemplate.id,
                operation: edit.operation
              }
            })
          )
        );

        // Wait for conflict resolution
        const resolution = await Promise.race([
          client1.waitForMessage('conflict_resolved'),
          client2.waitForMessage('conflict_resolved'),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Conflict resolution timeout')), 
            TEST_CONFIG.CONFLICT_RESOLUTION_THRESHOLD)
          )
        ]) as any;

        const resolutionTime = Date.now() - conflictStartTime;

        // Verify conflict was resolved within threshold
        expect(resolutionTime).toBeLessThan(TEST_CONFIG.CONFLICT_RESOLUTION_THRESHOLD);
        expect(resolution).toBeDefined();
        expect(resolution.data.conflictId).toBeDefined();
        expect(resolution.data.resolution).toBeDefined();

        // Verify both editors received the resolution
        const [final1, final2] = await Promise.all([
          client1.send({ type: 'get_template_content', data: { templateId: testTemplate.id } }),
          client2.send({ type: 'get_template_content', data: { templateId: testTemplate.id } })
        ]);

        expect(final1.content).toBe(final2.content);
      });

      it('should implement last-writer-wins for simple conflicts', async () => {
        const [editor1, editor2] = await Promise.all([
          createTestUser(),
          createTestUser()
        ]);
        const testTeam = await createTestTeam();
        const testTemplate = await createTestTemplate(editor1.id, testTeam.id);

        const [client1, client2] = await Promise.all([
          wsTestServer.createClient({
            userId: editor1.id,
            teamId: testTeam.id,
            token: generateTestJWT(editor1.id)
          }),
          wsTestServer.createClient({
            userId: editor2.id,
            teamId: testTeam.id,
            token: generateTestJWT(editor2.id)
          })
        ]);

        await Promise.all([client1.connect(), client2.connect()]);

        // Join template editing
        await Promise.all([
          client1.send({ type: 'join_edit_session', data: { templateId: testTemplate.id } }),
          client2.send({ type: 'join_edit_session', data: { templateId: testTemplate.id } })
        ]);

        // First edit (earlier timestamp)
        await client1.send({
          type: 'template_edit',
          data: {
            templateId: testTemplate.id,
            operation: {
              type: 'replace',
              start: 0,
              end: 5,
              content: 'Greetings',
              timestamp: Date.now()
            }
          }
        });

        // Second edit (later timestamp, should win)
        await client2.send({
          type: 'template_edit',
          data: {
            templateId: testTemplate.id,
            operation: {
              type: 'replace',
              start: 0,
              end: 5,
              content: 'Hello',
              timestamp: Date.now() + 100
            }
          }
        });

        await new Promise(resolve => setTimeout(resolve, 500));

        // Verify last writer wins
        const finalContent = await client1.send({
          type: 'get_template_content',
          data: { templateId: testTemplate.id }
        });

        expect(finalContent.content).toContain('Hello');
        expect(finalContent.content).not.toContain('Greetings');
      });
    });

    describe('Edit Session Management', () => {
      it('should track active editors and their cursor positions', async () => {
        const editors = await Promise.all([
          createTestUser('Editor A'),
          createTestUser('Editor B'),
          createTestUser('Editor C')
        ]);
        const testTeam = await createTestTeam();
        const testTemplate = await createTestTemplate(editors[0].id, testTeam.id);

        const clients = await Promise.all(
          editors.map(user =>
            wsTestServer.createClient({
              userId: user.id,
              teamId: testTeam.id,
              token: generateTestJWT(user.id)
            })
          )
        );

        await Promise.all(clients.map(client => client.connect()));

        // Editors join template with cursor positions
        const joinPromises = clients.map((client, index) =>
          client.send({
            type: 'join_edit_session',
            data: {
              templateId: testTemplate.id,
              cursorPosition: index * 10 // Different cursor positions
            }
          })
        );

        await Promise.all(joinPromises);

        // Get active session info
        const sessionInfo = await realTimeTemplateService.getActiveSession(testTemplate.id);

        expect(sessionInfo).toEqual({
          templateId: testTemplate.id,
          activeEditors: expect.arrayContaining([
            expect.objectContaining({
              userId: editors[0].id,
              cursorPosition: 0,
              joinedAt: expect.any(Date)
            }),
            expect.objectContaining({
              userId: editors[1].id,
              cursorPosition: 10,
              joinedAt: expect.any(Date)
            }),
            expect.objectContaining({
              userId: editors[2].id,
              cursorPosition: 20,
              joinedAt: expect.any(Date)
            })
          ]),
          createdAt: expect.any(Date),
          lastActivity: expect.any(Date)
        });

        // Update cursor positions
        await clients[1].send({
          type: 'cursor_update',
          data: {
            templateId: testTemplate.id,
            cursorPosition: 25
          }
        });

        // Verify other editors receive cursor updates
        const cursorUpdate = await clients[0].waitForMessage('cursor_moved', 1000);
        expect(cursorUpdate.data.userId).toBe(editors[1].id);
        expect(cursorUpdate.data.cursorPosition).toBe(25);
      });

      it('should handle editor disconnections gracefully', async () => {
        const editors = await Promise.all([
          createTestUser(),
          createTestUser(),
          createTestUser()
        ]);
        const testTeam = await createTestTeam();
        const testTemplate = await createTestTemplate(editors[0].id, testTeam.id);

        const clients = await Promise.all(
          editors.map(user =>
            wsTestServer.createClient({
              userId: user.id,
              teamId: testTeam.id,
              token: generateTestJWT(user.id)
            })
          )
        );

        await Promise.all(clients.map(client => client.connect()));

        // All join editing session
        await Promise.all(
          clients.map(client =>
            client.send({
              type: 'join_edit_session',
              data: { templateId: testTemplate.id }
            })
          )
        );

        // Verify all are in session
        let sessionInfo = await realTimeTemplateService.getActiveSession(testTemplate.id);
        expect(sessionInfo.activeEditors).toHaveLength(3);

        // One editor disconnects
        await clients[1].disconnect();

        // Wait for disconnection to be processed
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Verify session updated
        sessionInfo = await realTimeTemplateService.getActiveSession(testTemplate.id);
        expect(sessionInfo.activeEditors).toHaveLength(2);
        expect(sessionInfo.activeEditors.map(e => e.userId)).not.toContain(editors[1].id);

        // Remaining editors should be notified
        const disconnectionNotification = await clients[0].waitForMessage('editor_left', 1000);
        expect(disconnectionNotification.data.userId).toBe(editors[1].id);
      });

      it('should save draft changes automatically', async () => {
        const editor = await createTestUser();
        const testTeam = await createTestTeam();
        const testTemplate = await createTestTemplate(editor.id, testTeam.id);

        const client = await wsTestServer.createClient({
          userId: editor.id,
          teamId: testTeam.id,
          token: generateTestJWT(editor.id)
        });

        await client.connect();
        await client.send({
          type: 'join_edit_session',
          data: { templateId: testTemplate.id }
        });

        // Make several edits
        const edits = [
          { type: 'insert', position: 0, content: 'Draft: ' },
          { type: 'insert', position: 20, content: ' (in progress)' },
          { type: 'replace', start: 30, end: 40, content: 'updated' }
        ];

        for (const edit of edits) {
          await client.send({
            type: 'template_edit',
            data: {
              templateId: testTemplate.id,
              operation: edit
            }
          });
          
          // Wait briefly between edits
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Disconnect without saving
        await client.disconnect();

        // Reconnect and verify draft was saved
        await client.connect();
        const draftContent = await client.send({
          type: 'get_draft_content',
          data: { templateId: testTemplate.id }
        });

        expect(draftContent.hasDraft).toBe(true);
        expect(draftContent.content).toContain('Draft:');
        expect(draftContent.content).toContain('(in progress)');
        expect(draftContent.content).toContain('updated');
      });
    });
  });

  describe('Team Communication Features', () => {
    describe('Real-Time Notifications', () => {
      it('should broadcast team notifications to all online members', async () => {
        const teamMembers = await Promise.all([
          createTestUser('Team Lead'),
          createTestUser('Member 1'),
          createTestUser('Member 2'),
          createTestUser('Member 3')
        ]);
        const testTeam = await createTestTeam();

        // Connect team members
        const clients = await Promise.all(
          teamMembers.map(member =>
            wsTestServer.createClient({
              userId: member.id,
              teamId: testTeam.id,
              token: generateTestJWT(member.id)
            })
          )
        );

        await Promise.all(clients.map(client => client.connect()));

        // Team lead sends notification
        const notification = {
          type: 'team_announcement',
          data: {
            title: 'New LinkedIn Campaign',
            message: 'We are launching a new connection campaign targeting software engineers.',
            priority: 'high',
            sender: teamMembers[0].id
          }
        };

        await wsTestServer.broadcastToTeam(testTeam.id, notification);

        // Verify all team members received notification
        const notifications = await Promise.all(
          clients.map(client => client.waitForMessage('team_announcement', 2000))
        );

        notifications.forEach(receivedNotification => {
          expect(receivedNotification).toBeDefined();
          expect(receivedNotification.data.title).toBe('New LinkedIn Campaign');
          expect(receivedNotification.data.priority).toBe('high');
          expect(receivedNotification.data.sender).toBe(teamMembers[0].id);
        });
      });

      it('should handle targeted notifications to specific team members', async () => {
        const teamMembers = await Promise.all([
          createTestUser('Manager'),
          createTestUser('Developer'),
          createTestUser('Designer'),
          createTestUser('Marketing')
        ]);
        const testTeam = await createTestTeam();

        const clients = await Promise.all(
          teamMembers.map(member =>
            wsTestServer.createClient({
              userId: member.id,
              teamId: testTeam.id,
              token: generateTestJWT(member.id)
            })
          )
        );

        await Promise.all(clients.map(client => client.connect()));

        // Send targeted notification to specific members
        const targetedNotification = {
          type: 'task_assignment',
          data: {
            title: 'Review LinkedIn Templates',
            message: 'Please review the new connection templates for approval.',
            assignedTo: [teamMembers[1].id, teamMembers[2].id], // Developer and Designer
            dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            sender: teamMembers[0].id
          }
        };

        await wsTestServer.sendToUsers(
          targetedNotification.data.assignedTo,
          targetedNotification
        );

        // Verify targeted members received notification
        const [devNotification, designerNotification] = await Promise.all([
          clients[1].waitForMessage('task_assignment', 2000),
          clients[2].waitForMessage('task_assignment', 2000)
        ]);

        expect(devNotification.data.title).toBe('Review LinkedIn Templates');
        expect(designerNotification.data.title).toBe('Review LinkedIn Templates');

        // Verify non-targeted members did not receive it
        await expect(
          clients[3].waitForMessage('task_assignment', 1000)
        ).rejects.toThrow('timeout');
      });
    });

    describe('Activity Feeds and Status Updates', () => {
      it('should stream team activity updates in real-time', async () => {
        const teamMembers = await Promise.all([
          createTestUser('Active Member'),
          createTestUser('Observer')
        ]);
        const testTeam = await createTestTeam();

        const [activeClient, observerClient] = await Promise.all(
          teamMembers.map(member =>
            wsTestServer.createClient({
              userId: member.id,
              teamId: testTeam.id,
              token: generateTestJWT(member.id)
            })
          )
        );

        await Promise.all([activeClient.connect(), observerClient.connect()]);

        // Subscribe to team activity feed
        await observerClient.send({
          type: 'subscribe_activity_feed',
          data: { teamId: testTeam.id }
        });

        // Generate various activities
        const activities = [
          {
            type: 'template_created',
            data: {
              templateId: 'new-template-1',
              templateName: 'Software Engineer Outreach',
              createdBy: teamMembers[0].id
            }
          },
          {
            type: 'automation_started',
            data: {
              campaignId: 'campaign-1',
              campaignName: 'Q1 Networking Campaign',
              startedBy: teamMembers[0].id
            }
          },
          {
            type: 'linkedin_connection_made',
            data: {
              connectionName: 'John Doe',
              connectionTitle: 'Senior Developer',
              connectedBy: teamMembers[0].id
            }
          }
        ];

        // Send activities
        for (const activity of activities) {
          await wsTestServer.broadcastToTeam(testTeam.id, {
            type: 'activity_update',
            data: activity
          });
          
          // Small delay between activities
          await new Promise(resolve => setTimeout(resolve, 200));
        }

        // Verify observer received all activities
        const receivedActivities = [];
        for (let i = 0; i < activities.length; i++) {
          const activity = await observerClient.waitForMessage('activity_update', 1000);
          receivedActivities.push(activity.data);
        }

        expect(receivedActivities).toHaveLength(3);
        expect(receivedActivities[0].type).toBe('template_created');
        expect(receivedActivities[1].type).toBe('automation_started');
        expect(receivedActivities[2].type).toBe('linkedin_connection_made');
      });

      it('should track and broadcast user online/offline status', async () => {
        const teamMembers = await Promise.all([
          createTestUser('Always Online'),
          createTestUser('Sometimes Online'),
          createTestUser('Status Observer')
        ]);
        const testTeam = await createTestTeam();

        const clients = await Promise.all(
          teamMembers.map(member =>
            wsTestServer.createClient({
              userId: member.id,
              teamId: testTeam.id,
              token: generateTestJWT(member.id)
            })
          )
        );

        // Observer connects first
        await clients[2].connect();
        await clients[2].send({
          type: 'subscribe_team_presence',
          data: { teamId: testTeam.id }
        });

        // First member comes online
        await clients[0].connect();
        
        const onlineStatus1 = await clients[2].waitForMessage('user_status_changed', 1000);
        expect(onlineStatus1.data.userId).toBe(teamMembers[0].id);
        expect(onlineStatus1.data.status).toBe('online');

        // Second member comes online
        await clients[1].connect();
        
        const onlineStatus2 = await clients[2].waitForMessage('user_status_changed', 1000);
        expect(onlineStatus2.data.userId).toBe(teamMembers[1].id);
        expect(onlineStatus2.data.status).toBe('online');

        // Second member goes offline
        await clients[1].disconnect();
        
        const offlineStatus = await clients[2].waitForMessage('user_status_changed', 1000);
        expect(offlineStatus.data.userId).toBe(teamMembers[1].id);
        expect(offlineStatus.data.status).toBe('offline');

        // Get current team presence
        const teamPresence = await clients[2].send({
          type: 'get_team_presence',
          data: { teamId: testTeam.id }
        });

        expect(teamPresence.onlineUsers).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              userId: teamMembers[0].id,
              status: 'online'
            }),
            expect.objectContaining({
              userId: teamMembers[2].id,
              status: 'online'
            })
          ])
        );

        expect(teamPresence.onlineUsers.find(u => u.userId === teamMembers[1].id)).toBeUndefined();
      });
    });
  });

  // Test helper functions
  async function createTestUser(name = 'Test User'): Promise<any> {
    return {
      id: 'user-' + Math.random().toString(36).substr(2, 9),
      name,
      email: `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
      createdAt: new Date()
    };
  }

  async function createTestTeam(name = 'Test Team'): Promise<any> {
    return {
      id: 'team-' + Math.random().toString(36).substr(2, 9),
      name,
      createdAt: new Date()
    };
  }

  async function createTestTemplate(ownerId: string, teamId: string): Promise<any> {
    return {
      id: 'template-' + Math.random().toString(36).substr(2, 9),
      ownerId,
      teamId,
      name: 'Test Connection Template',
      content: 'Hello, I would like to connect with you.',
      type: 'connection_request',
      createdAt: new Date()
    };
  }

  function generateTestJWT(userId: string): string {
    // Mock JWT generation - in real implementation, use proper JWT library
    const payload = {
      userId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour
    };
    return `header.${btoa(JSON.stringify(payload))}.signature`;
  }

  function generateExpiredJWT(userId: string): string {
    const payload = {
      userId,
      iat: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
      exp: Math.floor(Date.now() / 1000) - 3600 // 1 hour ago (expired)
    };
    return `header.${btoa(JSON.stringify(payload))}.signature`;
  }
});

// Performance monitoring for real-time features
export class RealTimePerformanceMonitor {
  private static metrics: {
    connectionTime: number[];
    messageLatency: number[];
    conflictResolutionTime: number[];
    broadcastTime: number[];
  } = {
    connectionTime: [],
    messageLatency: [],
    conflictResolutionTime: [],
    broadcastTime: []
  };

  static recordConnectionTime(time: number): void {
    this.metrics.connectionTime.push(time);
  }

  static recordMessageLatency(latency: number): void {
    this.metrics.messageLatency.push(latency);
  }

  static recordConflictResolutionTime(time: number): void {
    this.metrics.conflictResolutionTime.push(time);
  }

  static recordBroadcastTime(time: number): void {
    this.metrics.broadcastTime.push(time);
  }

  static getPerformanceReport(): any {
    const calculateStats = (values: number[]) => {
      if (values.length === 0) return { avg: 0, min: 0, max: 0, p95: 0 };
      
      const sorted = [...values].sort((a, b) => a - b);
      return {
        avg: values.reduce((sum, val) => sum + val, 0) / values.length,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        p95: sorted[Math.floor(sorted.length * 0.95)]
      };
    };

    return {
      connectionTime: calculateStats(this.metrics.connectionTime),
      messageLatency: calculateStats(this.metrics.messageLatency),
      conflictResolutionTime: calculateStats(this.metrics.conflictResolutionTime),
      broadcastTime: calculateStats(this.metrics.broadcastTime),
      totalSamples: {
        connections: this.metrics.connectionTime.length,
        messages: this.metrics.messageLatency.length,
        conflicts: this.metrics.conflictResolutionTime.length,
        broadcasts: this.metrics.broadcastTime.length
      }
    };
  }

  static reset(): void {
    this.metrics = {
      connectionTime: [],
      messageLatency: [],
      conflictResolutionTime: [],
      broadcastTime: []
    };
  }
}