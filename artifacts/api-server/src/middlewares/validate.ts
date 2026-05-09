import type { Request, Response, NextFunction } from "express";
import { z } from "zod/v4";

interface ValidationSchemas {
  body?: z.ZodType;
  params?: z.ZodType;
  query?: z.ZodType;
}

export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (schemas.body) {
      // type-coverage:ignore-next-line
      req.body = schemas.body.parse(req.body);
    }
    if (schemas.params) {
      req.params = schemas.params.parse(req.params) as Record<string, string>;
    }
    if (schemas.query) {
      const parsed = schemas.query.parse(req.query);
      Object.assign(req.query, parsed);
    }
    next();
  };
}
