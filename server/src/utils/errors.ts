export class AppError extends Error {
  constructor(public statusCode: number, message: string, public code?: string) {
    super(message);
  }
}

export class NotFoundError extends AppError {
  constructor(m = 'Not found') {
    super(404, m, 'NOT_FOUND');
  }
}

export class UnauthorizedError extends AppError {
  constructor(m = 'Unauthorized') {
    super(401, m, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(m = 'Forbidden') {
    super(403, m, 'FORBIDDEN');
  }
}

export class ValidationError extends AppError {
  constructor(public details: unknown, m = 'Validation failed') {
    super(400, m, 'VALIDATION');
  }
}
