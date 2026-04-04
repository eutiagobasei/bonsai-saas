import { Injectable, LoggerService as NestLoggerService, Scope } from '@nestjs/common';
import { Request } from 'express';

export interface LogContext {
  correlationId?: string;
  userId?: string;
  tenantId?: string;
  [key: string]: unknown;
}

interface StructuredLog {
  timestamp: string;
  level: string;
  message: string;
  context?: string;
  correlationId?: string;
  userId?: string;
  tenantId?: string;
  data?: unknown;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * Structured JSON logger service.
 * Outputs logs in JSON format for easy parsing by log aggregation tools.
 */
@Injectable({ scope: Scope.TRANSIENT })
export class LoggerService implements NestLoggerService {
  private context?: string;
  private logContext: LogContext = {};

  setContext(context: string): void {
    this.context = context;
  }

  setLogContext(context: LogContext): void {
    this.logContext = { ...this.logContext, ...context };
  }

  setFromRequest(request: Request): void {
    this.logContext = {
      ...this.logContext,
      correlationId: request.correlationId,
      userId: (request as any).user?.sub,
      tenantId: (request as any).user?.tenantId,
    };
  }

  log(message: string, context?: string | object): void {
    this.writeLog('info', message, context);
  }

  error(message: string, trace?: string, context?: string | object): void {
    this.writeLog('error', message, context, trace);
  }

  warn(message: string, context?: string | object): void {
    this.writeLog('warn', message, context);
  }

  debug(message: string, context?: string | object): void {
    this.writeLog('debug', message, context);
  }

  verbose(message: string, context?: string | object): void {
    this.writeLog('verbose', message, context);
  }

  private writeLog(
    level: string,
    message: string,
    contextOrData?: string | object,
    trace?: string,
  ): void {
    const log: StructuredLog = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: typeof contextOrData === 'string' ? contextOrData : this.context,
      ...this.logContext,
    };

    if (typeof contextOrData === 'object') {
      log.data = contextOrData;
    }

    if (trace) {
      log.error = {
        name: 'Error',
        message,
        stack: trace,
      };
    }

    // In production, output JSON; in development, use readable format
    if (process.env.NODE_ENV === 'production') {
      console.log(JSON.stringify(log));
    } else {
      const timestamp = log.timestamp;
      const levelUpper = level.toUpperCase().padEnd(7);
      const ctx = log.context ? `[${log.context}]` : '';
      const correlationId = log.correlationId ? `[${log.correlationId.substring(0, 8)}]` : '';
      const userId = log.userId ? `[user:${log.userId.substring(0, 8)}]` : '';

      console.log(
        `${timestamp} ${levelUpper} ${ctx}${correlationId}${userId} ${message}`,
      );

      if (log.data) {
        console.log('  Data:', JSON.stringify(log.data, null, 2));
      }

      if (trace) {
        console.log('  Stack:', trace);
      }
    }
  }
}
