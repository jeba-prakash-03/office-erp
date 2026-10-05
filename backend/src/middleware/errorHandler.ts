import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public details?: Record<string, any>;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 400, code?: string, details?: Record<string, any>) {
    super(message);
    this.statusCode = statusCode;
    this.code = code || (statusCode === 400 ? 'VALIDATION_ERROR' : statusCode === 401 ? 'UNAUTHORIZED' : statusCode === 403 ? 'FORBIDDEN' : statusCode === 404 ? 'NOT_FOUND' : statusCode === 409 ? 'CONFLICT' : 'INTERNAL_ERROR');
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const statusCode = err.statusCode || (err.status ? err.status : 500);
  const message = err.isOperational ? err.message : (err.message || 'Internal server error');
  const code = err.code || (statusCode === 400 ? 'VALIDATION_ERROR' : statusCode === 401 ? 'UNAUTHORIZED' : statusCode === 403 ? 'FORBIDDEN' : statusCode === 404 ? 'NOT_FOUND' : statusCode === 409 ? 'CONFLICT' : 'INTERNAL_ERROR');

  if (statusCode >= 500) {
    logger.error(`[${req.method}] ${req.originalUrl} - Error:`, err);
  } else {
    logger.warn(`[${req.method}] ${req.originalUrl} (${statusCode}) - ${message}`);
  }

  res.status(statusCode).json({
    success: false,
    message,
    error: {
      code,
      message,
      details: err.details || undefined,
      stack: process.env.NODE_ENV !== 'production' && statusCode >= 500 ? err.stack : undefined,
    },
  });
}
