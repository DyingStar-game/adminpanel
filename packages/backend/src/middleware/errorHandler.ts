/**
 * Global Express error handler for uncaught route errors.
 */
import type { Request, Response, NextFunction } from 'express';

/**
 * Logs the error and responds with a generic 500 JSON payload.
 * @param err - Thrown error.
 * @param _req - Express request.
 * @param res - Express response.
 * @param _next - Express next (unused in error handlers).
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  console.error(err);
  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: err.message || 'Erreur interne du serveur',
    status: 500,
  });
}
