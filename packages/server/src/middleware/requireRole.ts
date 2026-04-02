import { Request, Response, NextFunction } from "express";
import type { UserRole } from "../types/db";

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role as UserRole)) {
      res.status(403).json({
        error: "Forbidden",
        message: "You do not have permission to access this resource",
        statusCode: 403,
      });
      return;
    }
    next();
  };
}
