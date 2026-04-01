export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(401, message, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(403, message, "FORBIDDEN");
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(404, message, "NOT_FOUND");
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict") {
    super(409, message, "CONFLICT");
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation error") {
    super(422, message, "VALIDATION_ERROR");
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad request") {
    super(400, message, "BAD_REQUEST");
  }
}

export class InvalidStatusTransitionError extends AppError {
  constructor(from: string, to: string, entity = "entity") {
    super(422, `Cannot transition ${entity} from '${from}' to '${to}'`, "INVALID_STATUS_TRANSITION");
  }
}

export class AssetUnavailableError extends AppError {
  constructor(message = "Asset is not available for this operation") {
    super(422, message, "ASSET_UNAVAILABLE");
  }
}

export class BlacklistBlockedError extends AppError {
  public flags: { action: string; reason: string }[];
  constructor(message = "Client is blacklisted", flags: { action: string; reason: string }[] = []) {
    super(422, message, "BLACKLIST_BLOCKED");
    this.flags = flags;
  }
}
