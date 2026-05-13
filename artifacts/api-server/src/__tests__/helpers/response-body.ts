import type { Response } from "supertest";

export type ApiResponse<TData = Record<string, unknown>> = {
  data: TData;
  error: { code: string; message: string };
};

export function resBody<T>(res: Response): T {
  return (res as unknown as { body: T }).body;
}
