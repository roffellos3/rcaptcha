/**
 * rCAPTCHA Server Entry Point
 * 
 * Human verification via robots.txt
 * "Are you a robot?" - "No, I respect robots.txt"
 */

import { createServer, getServerInfo } from './server';
import type { Config } from './types';
import { configureLogger, log } from './logger';

// Load configuration from environment
const corsOriginsEnv = process.env.CORS_ORIGINS;
const config: Config = {
  port: parseInt(process.env.PORT || '9816', 10),
  challengeTimeoutMs: parseInt(process.env.CHALLENGE_TIMEOUT_MS || '9000', 10),
  tokenExpiryMs: parseInt(process.env.TOKEN_EXPIRY_MS || '60000', 10),
  // CORS: require explicit configuration (no wildcard default)
  corsOrigins: corsOriginsEnv ? corsOriginsEnv.split(',').map(s => s.trim()) : [],

  // Rate limiting
  rateLimitEnabled: process.env.RATE_LIMIT_ENABLED !== 'false',
  rateLimitStartPerMin: parseInt(process.env.RATE_LIMIT_START_PER_MIN || '10', 10),
  rateLimitSubmitPerMin: parseInt(process.env.RATE_LIMIT_SUBMIT_PER_MIN || '30', 10),
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),

  // Logging
  loggingEnabled: process.env.LOGGING_ENABLED !== 'false',
  logLevel: (process.env.LOG_LEVEL as Config['logLevel']) || 'info',
};

// Validate config
if (config.port < 1 || config.port > 65535) {
  console.error('Invalid PORT. Must be between 1 and 65535.');
  process.exit(1);
}

if (config.challengeTimeoutMs < 1000) {
  console.error('CHALLENGE_TIMEOUT_MS must be at least 1000ms');
  process.exit(1);
}

if (config.tokenExpiryMs < 1000) {
  console.error('TOKEN_EXPIRY_MS must be at least 1000ms');
  process.exit(1);
}

// Require OPENAI_API_KEY for coherence checking
if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY is required for coherence checking.');
  console.error('Set it via: OPENAI_API_KEY="sk-..." bun run src/index.ts');
  process.exit(1);
}

// Warn if CORS is not configured
if (config.corsOrigins.length === 0) {
  console.warn('Warning: CORS_ORIGINS not configured. Cross-origin requests will be blocked.');
  console.warn('Set CORS_ORIGINS="http://localhost:3000,https://yourapp.com" for allowed origins.');
}

// Initialize logger
configureLogger({
  enabled: config.loggingEnabled,
  level: config.logLevel,
});

// ASCII art banner
const banner = `
 ██████╗  ██████╗ █████╗ ██████╗ ████████╗ ██████╗██╗  ██╗ █████╗ 
 ██╔══██╗██╔════╝██╔══██╗██╔══██╗╚══██╔══╝██╔════╝██║  ██║██╔══██╗
 ██████╔╝██║     ███████║██████╔╝   ██║   ██║     ███████║███████║
 ██╔══██╗██║     ██╔══██║██╔═══╝    ██║   ██║     ██╔══██║██╔══██║
 ██║  ██║╚██████╗██║  ██║██║        ██║   ╚██████╗██║  ██║██║  ██║
 ╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚═╝        ╚═╝    ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝
                                                                   
 Human verification via robots.txt
 "Are you a robot?" - "No, I respect robots.txt"
`;

console.log(banner);

// Start server
const server = createServer(config);
const info = getServerInfo(server);

// Log startup event
log('info', 'server_started', {
  message: `Server started on port ${info.port}`,
  details: {
    port: info.port,
    rateLimitEnabled: config.rateLimitEnabled,
    loggingEnabled: config.loggingEnabled,
  },
});

console.log('━'.repeat(60));
console.log(`🚀 Server running at http://${info.hostname}:${info.port}`);
console.log('━'.repeat(60));
console.log('');
console.log('Configuration:');
console.log(`  Port:              ${config.port}`);
console.log(`  Challenge timeout: ${config.challengeTimeoutMs}ms`);
console.log(`  Token expiry:      ${config.tokenExpiryMs}ms`);
console.log(`  CORS origins:      ${config.corsOrigins.length > 0 ? config.corsOrigins.join(', ') : '(none)'}`);
console.log('');
console.log('Security:');
console.log(`  Rate limiting:     ${config.rateLimitEnabled ? 'enabled' : 'disabled'}`);
console.log(`  Start limit:       ${config.rateLimitStartPerMin}/min`);
console.log(`  Submit limit:      ${config.rateLimitSubmitPerMin}/min`);
console.log(`  Logging:           ${config.loggingEnabled ? 'enabled' : 'disabled'} (level: ${config.logLevel})`);
console.log('');
console.log('Endpoints:');
console.log(`  GET  /health       - Health check`);
console.log(`  POST /validate     - Validate token`);
console.log(`  POST /auth/start   - Start multi-block auth session`);
console.log(`  POST /auth/submit  - Submit answer (handles block progression)`);
console.log(`  GET  /auth/status  - Check session status`);
console.log(`  WS   /             - WebSocket challenge flow (legacy)`);
console.log('');
console.log('━'.repeat(60));

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nShutting down...');
  server.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\nShutting down...');
  server.stop();
  process.exit(0);
});

// Export for testing
export { server, config };
