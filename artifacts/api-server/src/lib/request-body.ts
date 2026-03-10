import type { Request } from "express";

export function getBody<T>(req: Request): T {
  return (req as unknown as { body: T }).body;
}

export function setBody<T>(req: Request, value: T): void {
  (req as unknown as { body: T }).body = value;
}
