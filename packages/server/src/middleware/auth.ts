import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import type { TokenPayload } from "../types/api";

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Missing or invalid authorization header",
      statusCode: 401,
    });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, config.jwt.secret) as TokenPayload;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({
      error: "Unauthorized",
      message: "Invalid or expired token",
      statusCode: 401,
    });
  }
}
