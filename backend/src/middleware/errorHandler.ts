import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('Error encountered:', err);

  if (err instanceof ZodError) {
    res.status(400).json({
      message: 'Validation failed',
      errors: err.errors.map(e => ({ path: e.path.join('.'), message: e.message }))
    });
    return;
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  res.status(statusCode).json({ message });
}
