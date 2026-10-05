import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { AppError } from './errorHandler';

export function validate(schema: AnyZodObject) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      req.body = parsed.body || req.body;
      req.query = parsed.query || req.query;
      req.params = parsed.params || req.params;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const fields: Record<string, string> = {};
        for (const issue of error.issues) {
          const pathSegments = issue.path.filter((p) => p !== 'body' && p !== 'query' && p !== 'params');
          const fieldKey = pathSegments.join('.') || 'root';
          if (!fields[fieldKey]) {
            fields[fieldKey] = issue.message;
          }
        }
        const issuesSummary = Object.entries(fields)
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ');
        
        return next(
          new AppError(
            `Validation error: ${issuesSummary}`,
            400,
            'VALIDATION_ERROR',
            { fields }
          )
        );
      }
      return next(error);
    }
  };
}
