import type { Request, Response, NextFunction } from "express";
import { z } from "zod/v4";

interface ValidationSchemas {
  body?: z.ZodType;
  params?: z.ZodType;
  query?: z.ZodType;
}

export function validate(schemas: ValidationSchemas) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        res.status(400).json({
          error: "Validation failed",
          details: result.error.issues.map((i: any) => ({
            path: i.path.join("."),
            message: i.message,
          })),
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
          details: result.error.issues.map((i: any) => ({
            path: i.path.join("."),
            message: i.message,
          })),
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
          details: result.error.issues.map((i: any) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        });
        return;
      }
      req.query = result.data;
    }
    next();
  };
}
