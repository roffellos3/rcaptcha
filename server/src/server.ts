/**
 * HTTP + WebSocket Server
 * 
 * Handles:
 * - GET /health - Health check endpoint
 * - POST /validate - Token validation endpoint
 * - GET/POST /challenge - Get a new challenge
 * - POST /submit - Submit an answer
 * - WebSocket / - Challenge/verification flow (legacy)
 */

import type { ServerWebSocket } from 'bun';
import type { Config, ServerMessage, ClientMessage, ValidateRequest, ChallengeType } from './types';
import { 
  generateChallenge,
  generateChallengeOfType, 
  challengeToPayload, 
  verifyAnswer, 
  consumeChallenge,
  getChallenge,
  type ChallengeAnswer,
  type MultiChallenge,
} from './challenges';
import { validateToken, createToken } from './token';
import {
  createSession,
  getSession,
  isBlockExpired,
  getBlockTimeRemaining,
  advanceToNextBlock,
  markSessionPassed,
  getSessionStats,
} from './sessions';
import { verifyCoherent, MAX_SENTENCE_LENGTH } from './challenges/coherent';
import {
  checkChallengeRateLimit,
  checkSubmitRateLimit,
  rateLimitResponse,
} from './rateLimit';
import { logFailure } from './logger';

// Input validation constants
const MAX_REQUEST_BODY_SIZE = 100 * 1024; // 100KB

// WebSocket connection limits
const MAX_TOTAL_CONNECTIONS = 1000;
const MAX_CONNECTIONS_PER_IP = 10;

// Track WebSocket connections per IP
const connectionsPerIp = new Map<string, number>();
let totalConnections = 0;

// WebSocket data attached to each connection
export interface WSData {
  challengeId?: string;
  challengeType?: ChallengeType;
  clientIp?: string;
  connectedAt: number;
}

/**
 * Create and start the server
 */
export function createServer(config: Config) {
  const server = Bun.serve<WSData>({
    port: config.port,
    
    // HTTP request handler
    async fetch(req, server) {
      const url = new URL(req.url);
      const clientIp = server.requestIP(req)?.address || req.headers.get('x-forwarded-for') || 'unknown';
      
      // CORS headers
      const corsHeaders = {
        'Access-Control-Allow-Origin': config.corsOrigins.includes('*') ? '*' : (config.corsOrigins.length > 0 ? config.corsOrigins[0] : ''),
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      };

      // Handle preflight
      if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
      }

      // Input validation: Check Content-Length before parsing body
      const contentLength = req.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > MAX_REQUEST_BODY_SIZE) {
        return Response.json(
          { error: `Request body too large. Maximum size is ${MAX_REQUEST_BODY_SIZE} bytes.` },
          { status: 413, headers: corsHeaders }
        );
      }
      
      // Health check endpoint
      if (url.pathname === '/health' && req.method === 'GET') {
        return Response.json(
          { 
            status: 'ok', 
            timestamp: Date.now(),
            version: '1.0.0',
          },
          { headers: corsHeaders }
        );
      }
      
      // Token validation endpoint
      if (url.pathname === '/validate' && req.method === 'POST') {
        try {
          const body = await req.json() as ValidateRequest;
          const result = validateToken(body.token);
          
          return Response.json(result, { 
            status: result.valid ? 200 : 400,
            headers: corsHeaders,
          });
        } catch {
          return Response.json(
            { valid: false, error: 'Invalid request body' },
            { status: 400, headers: corsHeaders }
          );
        }
      }
      
      // GET /challenge - Get a new challenge (for AI agents)
      if (url.pathname === '/challenge' && (req.method === 'GET' || req.method === 'POST')) {
        // Rate limiting
        const rateCheck = checkChallengeRateLimit(clientIp);
        if (!rateCheck.allowed) {
          logFailure('rate_limit_exceeded', {
            ip: clientIp,
            details: { endpoint: '/challenge', retryAfterMs: rateCheck.retryAfterMs },
          });
          return rateLimitResponse(rateCheck.retryAfterMs!, corsHeaders);
        }

        try {
          const challenge = generateChallenge(config, clientIp);
          const payload = challengeToPayload(challenge, config.challengeTimeoutMs);

          return Response.json({
            id: challenge.id,
            type: challenge.type,
            timeoutMs: config.challengeTimeoutMs,
            expiresAt: challenge.expiresAt,
            ...payload,
          }, { headers: corsHeaders });
        } catch {
          return Response.json(
            { error: 'Failed to generate challenge' },
            { status: 500, headers: corsHeaders }
          );
        }
      }
      
      // POST /submit - Submit an answer for a challenge
      if (url.pathname === '/submit' && req.method === 'POST') {
        try {
          const body = await req.json() as { challengeId: string; answer: string };
          
          if (!body.challengeId || body.answer === undefined) {
            return Response.json(
              { success: false, error: 'Missing challengeId or answer' },
              { status: 400, headers: corsHeaders }
            );
          }
          
          // Get the challenge
          const challenge = getChallenge(body.challengeId);
          if (!challenge) {
            logFailure('challenge_not_found', {
              ip: clientIp,
              challengeId: body.challengeId,
              details: { endpoint: '/submit' },
            });
            return Response.json(
              { success: false, error: 'Challenge not found or expired' },
              { status: 404, headers: corsHeaders }
            );
          }
          
          // Build answer object
          const answer: ChallengeAnswer = {
            type: challenge.type,
            challengeId: body.challengeId,
            answer: body.answer,
          };
          
          // Verify
          const result = await verifyAnswer(body.challengeId, answer);
          
          let token: string | undefined;
          if (result.success) {
            const tokenData = createToken(config, body.challengeId, clientIp);
            token = tokenData.token;
            consumeChallenge(body.challengeId);
          }
          
          return Response.json({
            success: result.success,
            token,
            error: result.error,
          }, { 
            status: result.success ? 200 : 400,
            headers: corsHeaders,
          });
        } catch {
          return Response.json(
            { success: false, error: 'Invalid request body' },
            { status: 400, headers: corsHeaders }
          );
        }
      }
      
      // ============ MULTI-BLOCK AUTH FLOW ============
      
      // POST /auth/start - Start a new multi-block auth session
      if (url.pathname === '/auth/start' && req.method === 'POST') {
        // Rate limiting (same as /challenge)
        const rateCheck = checkChallengeRateLimit(clientIp);
        if (!rateCheck.allowed) {
          logFailure('rate_limit_exceeded', {
            ip: clientIp,
            details: { endpoint: '/auth/start', retryAfterMs: rateCheck.retryAfterMs },
          });
          return rateLimitResponse(rateCheck.retryAfterMs!, corsHeaders);
        }

        try {
          const session = createSession(clientIp, config.challengeTimeoutMs);

          return Response.json({
            sessionId: session.id,
            block: session.currentBlock,
            maxBlocks: session.maxBlocks,
            challenge: {
              id: session.challenge.id,
              words: session.challenge.words,
              wordCount: session.challenge.wordCount,
            },
            timeoutMs: session.blockTimeoutMs,
            expiresAt: session.blockStartedAt + session.blockTimeoutMs,
          }, { headers: corsHeaders });
        } catch {
          return Response.json(
            { error: 'Failed to start auth session' },
            { status: 500, headers: corsHeaders }
          );
        }
      }
      
      // POST /auth/submit - Submit answer for current block
      if (url.pathname === '/auth/submit' && req.method === 'POST') {
        // Rate limiting
        const rateCheck = checkSubmitRateLimit(clientIp);
        if (!rateCheck.allowed) {
          logFailure('rate_limit_exceeded', {
            ip: clientIp,
            details: { endpoint: '/auth/submit', retryAfterMs: rateCheck.retryAfterMs },
          });
          return rateLimitResponse(rateCheck.retryAfterMs!, corsHeaders);
        }

        try {
          const body = await req.json() as { sessionId: string; answer: string };

          if (!body.sessionId || body.answer === undefined) {
            return Response.json(
              { success: false, error: 'Missing sessionId or answer' },
              { status: 400, headers: corsHeaders }
            );
          }

          // Input validation: answer length
          if (typeof body.answer === 'string' && body.answer.length > MAX_SENTENCE_LENGTH) {
            return Response.json(
              { success: false, error: `Answer too long. Maximum ${MAX_SENTENCE_LENGTH} characters.` },
              { status: 400, headers: corsHeaders }
            );
          }
          
          const session = getSession(body.sessionId);

          if (!session) {
            logFailure('session_not_found', {
              ip: clientIp,
              sessionId: body.sessionId,
              details: { endpoint: '/auth/submit' },
            });
            return Response.json(
              { success: false, error: 'Session not found or expired' },
              { status: 404, headers: corsHeaders }
            );
          }

          if (session.status !== 'active') {
            logFailure('session_expired', {
              ip: clientIp,
              sessionId: body.sessionId,
              details: { endpoint: '/auth/submit', status: session.status },
            });
            return Response.json(
              { success: false, error: `Session already ${session.status}` },
              { status: 400, headers: corsHeaders }
            );
          }
          
          // Check if current block has expired
          if (isBlockExpired(session)) {
            const advanced = advanceToNextBlock(session);

            if (!advanced) {
              logFailure('blocks_exhausted', {
                ip: clientIp,
                sessionId: body.sessionId,
                challengeId: session.challenge.id,
                details: { block: session.currentBlock, maxBlocks: session.maxBlocks },
              });
              return Response.json({
                success: false,
                authFailed: true,
                error: 'All blocks exhausted. Authentication failed.',
                block: session.currentBlock,
              }, {
                status: 401,
                headers: corsHeaders,
              });
            }
            
            return Response.json({
              success: false,
              blockExpired: true,
              newBlock: session.currentBlock,
              challenge: {
                id: session.challenge.id,
                words: session.challenge.words,
                wordCount: session.challenge.wordCount,
              },
              timeoutMs: session.blockTimeoutMs,
              expiresAt: session.blockStartedAt + session.blockTimeoutMs,
              message: `Block ${session.currentBlock - 1} expired. Now on block ${session.currentBlock} of ${session.maxBlocks}.`,
            }, { 
              status: 200,
              headers: corsHeaders,
            });
          }
          
          // Verify the answer
          const verifyResult = await verifyCoherent(
            session.challenge,
            { sentence: body.answer }
          );
          
          if (verifyResult.valid) {
            markSessionPassed(session);
            const tokenData = createToken(config, session.challenge.id, clientIp);

            return Response.json({
              success: true,
              token: tokenData.token,
              block: session.currentBlock,
              coherenceScore: verifyResult.coherenceScore,
            }, { headers: corsHeaders });
          }

          logFailure('coherence_failed', {
            ip: clientIp,
            sessionId: body.sessionId,
            challengeId: session.challenge.id,
            details: {
              coherenceScore: verifyResult.coherenceScore,
              errors: verifyResult.errors,
              block: session.currentBlock,
            },
          });

          return Response.json({
            success: false,
            errors: verifyResult.errors,
            block: session.currentBlock,
            timeRemaining: getBlockTimeRemaining(session),
            coherenceScore: verifyResult.coherenceScore,
            hint: 'You can retry within the timeout window.',
          }, {
            status: 400,
            headers: corsHeaders,
          });
          
        } catch {
          return Response.json(
            { success: false, error: 'Invalid request body' },
            { status: 400, headers: corsHeaders }
          );
        }
      }
      
      // GET /auth/status - Check session status
      if (url.pathname === '/auth/status' && req.method === 'GET') {
        const sessionId = url.searchParams.get('sessionId');
        
        if (!sessionId) {
          const stats = getSessionStats();
          return Response.json(stats, { headers: corsHeaders });
        }
        
        const session = getSession(sessionId);
        if (!session) {
          return Response.json(
            { error: 'Session not found' },
            { status: 404, headers: corsHeaders }
          );
        }
        
        return Response.json({
          sessionId: session.id,
          status: session.status,
          currentBlock: session.currentBlock,
          maxBlocks: session.maxBlocks,
          blockExpired: isBlockExpired(session),
          timeRemaining: getBlockTimeRemaining(session),
        }, { headers: corsHeaders });
      }
      
      // WebSocket upgrade
      if (url.pathname === '/' || url.pathname === '/ws') {
        // Check connection limits
        if (totalConnections >= MAX_TOTAL_CONNECTIONS) {
          return Response.json(
            { error: 'Server at maximum WebSocket capacity' },
            { status: 503, headers: corsHeaders }
          );
        }

        const ipConnections = connectionsPerIp.get(clientIp) || 0;
        if (ipConnections >= MAX_CONNECTIONS_PER_IP) {
          logFailure('rate_limit_exceeded', {
            ip: clientIp,
            details: { endpoint: 'websocket', reason: 'max_connections_per_ip', currentConnections: ipConnections },
          });
          return Response.json(
            { error: `Maximum ${MAX_CONNECTIONS_PER_IP} connections per IP reached` },
            { status: 429, headers: corsHeaders }
          );
        }

        const upgraded = server.upgrade(req, {
          data: {
            clientIp,
            connectedAt: Date.now(),
          } as WSData,
        });

        if (upgraded) {
          return undefined;
        }

        return new Response('WebSocket upgrade failed', { status: 400 });
      }
      
      // 404 for unknown routes
      return new Response('Not Found', { status: 404, headers: corsHeaders });
    },
    
    // WebSocket handlers
    websocket: {
      open(ws: ServerWebSocket<WSData>) {
        // Track connection count
        totalConnections++;
        const ip = ws.data.clientIp || 'unknown';
        connectionsPerIp.set(ip, (connectionsPerIp.get(ip) || 0) + 1);

        const challenge = generateChallenge(config, ws.data.clientIp);
        ws.data.challengeId = challenge.id;
        ws.data.challengeType = challenge.type;
        
        const payload = challengeToPayload(challenge, config.challengeTimeoutMs);
        
        const message: ServerMessage = {
          type: 'challenge',
          challengeId: challenge.id,
          challengeType: challenge.type,
          timeoutMs: config.challengeTimeoutMs,
          words: payload.words,
          wordCount: payload.wordCount,
          instruction: payload.instruction,
        };
        
        ws.send(JSON.stringify(message));
        
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            const timeoutMsg: ServerMessage = {
              type: 'timeout',
              challengeId: challenge.id,
              message: 'Challenge timed out',
            };
            ws.send(JSON.stringify(timeoutMsg));
            ws.close(1000, 'Challenge timeout');
          }
        }, config.challengeTimeoutMs);
      },
      
      message(ws: ServerWebSocket<WSData>, message: string | Buffer) {
        try {
          const data = JSON.parse(message.toString()) as ClientMessage;
          
          if (data.type === 'verify') {
            const challenge = getChallenge(data.challengeId);

            if (!challenge) {
              logFailure('challenge_not_found', {
                ip: ws.data.clientIp || 'unknown',
                challengeId: data.challengeId,
                details: { endpoint: 'websocket' },
              });
              const response: ServerMessage = {
                type: 'result',
                challengeId: data.challengeId,
                success: false,
                message: 'Challenge not found or expired',
              };
              ws.send(JSON.stringify(response));
              return;
            }
            
            const answer: ChallengeAnswer = {
              type: challenge.type,
              challengeId: data.challengeId,
              answer: data.answer || '',
            };
            
            verifyAnswer(data.challengeId, answer).then((result) => {
              let token: string | undefined;
              if (result.success) {
                const tokenData = createToken(config, data.challengeId, ws.data.clientIp);
                token = tokenData.token;
                consumeChallenge(data.challengeId);
              }
              
              const response: ServerMessage = {
                type: 'result',
                challengeId: data.challengeId,
                success: result.success,
                token,
                message: result.error,
              };
              
              ws.send(JSON.stringify(response));
              
              if (result.success) {
                setTimeout(() => ws.close(1000, 'Verification complete'), 100);
              }
            }).catch(() => {
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Verification failed',
              }));
            });
          } else {
            const errorMsg: ServerMessage = {
              type: 'error',
              message: `Unknown message type: ${(data as any).type}`,
            };
            ws.send(JSON.stringify(errorMsg));
          }
        } catch {
          const errorMsg: ServerMessage = {
            type: 'error',
            message: 'Invalid message format',
          };
          ws.send(JSON.stringify(errorMsg));
        }
      },
      
      close(ws: ServerWebSocket<WSData>) {
        // Track connection count
        totalConnections = Math.max(0, totalConnections - 1);
        const ip = ws.data.clientIp || 'unknown';
        const current = connectionsPerIp.get(ip) || 0;
        if (current <= 1) {
          connectionsPerIp.delete(ip);
        } else {
          connectionsPerIp.set(ip, current - 1);
        }
      },
    },
  });
  
  return server;
}

/**
 * Get server info
 */
export function getServerInfo(server: ReturnType<typeof Bun.serve<WSData>>) {
  return {
    hostname: server.hostname,
    port: server.port,
    development: server.development,
  };
}
