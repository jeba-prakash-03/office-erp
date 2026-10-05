import { Response } from 'express';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  meta?: PaginationMeta | Record<string, any>,
  statusCode = 200,
  message?: string
) {
  return res.status(statusCode).json({
    data,
    ...(meta ? { meta } : {}),
    ...(message ? { message } : {}),
    success: true,
  });
}

export function sendCreated<T>(res: Response, data: T, message = 'Resource created successfully') {
  return sendSuccess(res, data, undefined, 201, message);
}
