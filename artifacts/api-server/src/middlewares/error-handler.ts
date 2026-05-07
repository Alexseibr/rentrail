import type {
  Request,
  Response,
  NextFunction,
  ErrorRequestHandler,
} from "express";
import { AppError } from "../lib/errors";
import { ZodError } from "zod/v4";

export const errorHandler: ErrorRequestHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (err instanceof AppError) {
    const body: Record<string, unknown> = {
      code: err.code,
      message: err.message,
    };
    if ("flags" in err && Array.isArray((err as { flags: unknown[] }).flags)) {
      body.flags = (err as { flags: unknown[] }).flags;
    }
    res.status(err.statusCode).json({ error: body });
    return;
  }

  if (err instanceof ZodError) {
    res.status(422).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Validation failed",
        details: err.issues,
      },
    });
    return;
  }

  req.log?.error({ err }, "Unhandled error");

  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Internal server error",
    },
  });
};
