import type { Response } from "supertest";

export function resBody<T>(res: Response): T {
  return (res as unknown as { body: T }).body;
}
