import { Request, Response, NextFunction } from "express";
import { config } from "../config";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.name,
      message: err.message,
      statusCode: err.statusCode,
    });
    return;
  }

  // Log full error details server-side only
  console.error("Unhandled error:", err);

  // Never expose internal details to the client in production
  res.status(500).json({
    error: "InternalServerError",
    message: "An unexpected error occurred",
    statusCode: 500,
    // Only show stack trace in development for debugging
    ...(config.isDev && { debug: err.message }),
  });
}
