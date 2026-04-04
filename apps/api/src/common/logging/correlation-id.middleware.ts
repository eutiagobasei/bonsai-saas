import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

// Extend Express Request to include correlationId
declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
    }
  }
}

/**
 * Middleware that adds a correlation ID to each request.
 * This allows tracking requests across logs and services.
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    // Use existing correlation ID from header or generate new one
    const correlationId =
      (req.headers[CORRELATION_ID_HEADER] as string) || randomUUID();

    req.correlationId = correlationId;

    // Set correlation ID in response headers
    res.setHeader(CORRELATION_ID_HEADER, correlationId);

    next();
  }
}
