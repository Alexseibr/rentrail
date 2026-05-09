import type { Response } from "supertest";

export type ApiResponse = {
  data: Record<string, unknown>;
  error: { code: string; message: string };
};

export function resBody<T>(res: Response): T {
  return (res as unknown as { body: T }).body;
}
