import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

export function requirePermission(...permissions: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Unauthorized. Authentication required.', 401));
    }

    // Super Admin has unrestricted access to all endpoints
    if (req.user.roleName === 'super_admin') {
      return next();
    }

    const hasAll = permissions.every((perm) => req.user!.permissions.includes(perm));

    if (!hasAll) {
      return next(
        new AppError(
          `Forbidden: You lack required permissions [${permissions.join(', ')}] to perform this action.`,
          403
        )
      );
    }

    next();
  };
}

export function requireAnyPermission(...permissions: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Unauthorized. Authentication required.', 401));
    }

    if (req.user.roleName === 'super_admin') {
      return next();
    }

    const hasAny = permissions.some((perm) => req.user!.permissions.includes(perm));

    if (!hasAny) {
      return next(
        new AppError('Forbidden: You lack necessary permissions for this resource.', 403)
      );
    }

    next();
  };
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Unauthorized. Authentication required.', 401));
    }

    if (req.user.roleName === 'super_admin') {
      return next();
    }

    if (!roles.includes(req.user.roleName)) {
      return next(
        new AppError(`Forbidden: Access restricted to roles [${roles.join(', ')}].`, 403)
      );
    }

    next();
  };
}
