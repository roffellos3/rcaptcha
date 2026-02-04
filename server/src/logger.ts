/**
 * Structured JSON Logger
 *
 * Provides structured logging for security events and failure tracking.
 * Outputs JSON Lines format to stdout for easy log aggregation.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type FailureEvent =
  | 'rate_limit_exceeded'
  | 'session_not_found'
  | 'session_expired'
  | 'coherence_failed'
  | 'blocks_exhausted'
  | 'challenge_not_found';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  event: string;
  message?: string;
  ip?: string;
  sessionId?: string;
  challengeId?: string;
  details?: Record<string, unknown>;
}

interface FailureLogEntry extends LogEntry {
  event: FailureEvent;
  details: {
    failureCount?: number;
    isRepeatOffender?: boolean;
    [key: string]: unknown;
  };
}

interface LoggerConfig {
  enabled: boolean;
  level: LogLevel;
}

// Logger configuration
let loggerConfig: LoggerConfig = {
  enabled: true,
  level: 'info',
};

// Log level priority
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Failure tracking for pattern detection
// Map of IP -> timestamps of failures
const failureTracker = new Map<string, number[]>();

// Pattern detection config
const FAILURE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const REPEAT_OFFENDER_THRESHOLD = 5;

/**
 * Configure the logger
 */
export function configureLogger(config: Partial<LoggerConfig>): void {
  if (config.enabled !== undefined) {
    loggerConfig.enabled = config.enabled;
  }
  if (config.level !== undefined) {
    loggerConfig.level = config.level;
  }
}

/**
 * Get current logger configuration
 */
export function getLoggerConfig(): LoggerConfig {
  return { ...loggerConfig };
}

/**
 * Check if a log level should be output
 */
function shouldLog(level: LogLevel): boolean {
  if (!loggerConfig.enabled) return false;
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[loggerConfig.level];
}

/**
 * Output a log entry
 */
function output(entry: LogEntry): void {
  console.log(JSON.stringify(entry));
}

/**
 * General purpose logging function
 */
export function log(
  level: LogLevel,
  event: string,
  options: {
    message?: string;
    ip?: string;
    sessionId?: string;
    challengeId?: string;
    details?: Record<string, unknown>;
  } = {}
): void {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...options,
  };

  // Remove undefined fields
  Object.keys(entry).forEach(key => {
    if (entry[key as keyof LogEntry] === undefined) {
      delete entry[key as keyof LogEntry];
    }
  });

  output(entry);
}

/**
 * Track a failure for pattern detection
 * Returns failure count and repeat offender status
 */
export function trackFailure(ip: string): { failureCount: number; isRepeatOffender: boolean } {
  const now = Date.now();

  // Get or create failure history for this IP
  let failures = failureTracker.get(ip) || [];

  // Filter to only include failures within the window
  failures = failures.filter(ts => now - ts < FAILURE_WINDOW_MS);

  // Add this failure
  failures.push(now);
  failureTracker.set(ip, failures);

  const failureCount = failures.length;
  const isRepeatOffender = failureCount >= REPEAT_OFFENDER_THRESHOLD;

  return { failureCount, isRepeatOffender };
}

/**
 * Log a failure event with automatic pattern detection
 */
export function logFailure(
  event: FailureEvent,
  options: {
    ip: string;
    sessionId?: string;
    challengeId?: string;
    details?: Record<string, unknown>;
  }
): void {
  // Track the failure
  const { failureCount, isRepeatOffender } = trackFailure(options.ip);

  // Determine log level based on repeat offender status
  const level: LogLevel = isRepeatOffender ? 'error' : 'warn';

  if (!shouldLog(level)) return;

  const entry: FailureLogEntry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ip: options.ip,
    sessionId: options.sessionId,
    challengeId: options.challengeId,
    details: {
      ...options.details,
      failureCount,
      isRepeatOffender,
    },
  };

  // Remove undefined fields
  if (entry.sessionId === undefined) delete entry.sessionId;
  if (entry.challengeId === undefined) delete entry.challengeId;

  output(entry);
}

/**
 * Clean up old failure tracking entries
 */
export function cleanupFailureTracker(): void {
  const now = Date.now();

  for (const [ip, failures] of failureTracker.entries()) {
    const recentFailures = failures.filter(ts => now - ts < FAILURE_WINDOW_MS);

    if (recentFailures.length === 0) {
      failureTracker.delete(ip);
    } else {
      failureTracker.set(ip, recentFailures);
    }
  }
}

/**
 * Get failure tracker stats (for testing/debugging)
 */
export function getFailureTrackerStats(): { trackedIps: number; totalFailures: number } {
  let totalFailures = 0;
  for (const failures of failureTracker.values()) {
    totalFailures += failures.length;
  }
  return {
    trackedIps: failureTracker.size,
    totalFailures,
  };
}

// Start cleanup interval (every minute)
const cleanupInterval = setInterval(cleanupFailureTracker, 60 * 1000);

// Prevent the interval from keeping Node.js alive
if (cleanupInterval.unref) {
  cleanupInterval.unref();
}
