import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';

export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const incoming = req.header(REQUEST_ID_HEADER);
  const requestId =
    incoming && incoming.trim().length > 0 && incoming.length <= 128
      ? incoming.trim()
      : randomUUID();
  (req as Request & { requestId: string }).requestId = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);
  next();
}

export function getRequestId(req: Request): string {
  return (req as Request & { requestId?: string }).requestId ?? 'unknown';
}
