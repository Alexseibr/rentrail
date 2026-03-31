import { logger } from "./logger";

export interface ErrorContext {
  userId?: string;
  companyId?: string;
  correlationId?: string;
  route?: string;
  extra?: Record<string, unknown>;
}

export interface ErrorTracker {
  captureException(error: Error, context?: ErrorContext): void;
  captureWarning(message: string, context?: ErrorContext): void;
  setUser(userId: string, email?: string): void;
}

class LoggerErrorTracker implements ErrorTracker {
  captureException(error: Error, context?: ErrorContext): void {
    logger.error(
      {
        err: error,
        errorTracking: true,
        ...context,
      },
      `[ErrorTracker] ${error.message}`,
    );
  }

  captureWarning(message: string, context?: ErrorContext): void {
    logger.warn(
      {
        errorTracking: true,
        ...context,
      },
      `[ErrorTracker] ${message}`,
    );
  }

  setUser(_userId: string, _email?: string): void {}
}

let _tracker: ErrorTracker = new LoggerErrorTracker();

export function getErrorTracker(): ErrorTracker {
  return _tracker;
}

export function setErrorTracker(tracker: ErrorTracker): void {
  _tracker = tracker;
}
