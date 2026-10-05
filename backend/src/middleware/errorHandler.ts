import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.statusCode = statusCode;
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

  if (statusCode >= 500) {
    logger.error(`[${req.method}] ${req.originalUrl} - Error:`, err);
  } else {
    logger.warn(`[${req.method}] ${req.originalUrl} (${statusCode}) - ${message}`);
  }

  res.status(statusCode).json({
    success: false,
    message,
    error: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
  });
}
