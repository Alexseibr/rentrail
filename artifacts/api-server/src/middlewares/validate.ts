import type { Request, Response, NextFunction } from "express";
import { z } from "zod/v4";

interface ValidationSchemas {
  body?: z.ZodType;
  params?: z.ZodType;
  query?: z.ZodType;
}

interface ZodIssue {
  path: (string | number)[];
  message: string;
}

function formatIssues(issues: ZodIssue[]) {
  return issues.map((i) => ({
    path: i.path.join("."),
    message: i.message,
  }));
}

export function validate(schemas: ValidationSchemas) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        res.status(400).json({
          error: "Validation failed",
          details: formatIssues(result.error.issues),
        });
        return;
      }
      req.body = result.data;
    }
    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        res.status(400).json({
          error: "Validation failed",
          details: formatIssues(result.error.issues),
        });
        return;
      }
      req.params = result.data;
    }
    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        res.status(400).json({
          error: "Validation failed",
          details: formatIssues(result.error.issues),
        });
        return;
      }
      req.query = result.data;
    }
    next();
  };
}
