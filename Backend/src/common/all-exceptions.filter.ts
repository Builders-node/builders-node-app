import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Global exception filter: one consistent JSON error shape for the whole API,
 * and a logged stack for every 5xx so Vercel/host logs give real observability.
 * Never leaks internals — unexpected errors surface a generic message.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const duplicate = !isHttp ? uniqueViolation(exception) : null;
    const status = isHttp
      ? exception.getStatus()
      : duplicate
        ? HttpStatus.CONFLICT
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string | string[] = 'Internal server error.';
    if (isHttp) {
      const body = exception.getResponse();
      message = typeof body === 'string' ? body : ((body as { message?: string | string[] }).message ?? exception.message);
    } else if (duplicate) {
      message = duplicate;
    }

    if (status >= 500) {
      // Log the full error (goes to host/Vercel logs). Wire Sentry here later if desired.
      this.logger.error(`${request.method} ${request.url} -> ${status}`, exception instanceof Error ? exception.stack : String(exception));
    }

    response.status(status).json({
      statusCode: status,
      message,
      error: HttpStatus[status] ?? 'Error',
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}

/** Human-readable field names for the unique constraints users can actually hit. */
const UNIQUE_FIELD_LABELS: Record<string, string> = {
  email: 'email address',
  name: 'name',
  slug: 'slug',
};

/**
 * Turn Prisma's unique-constraint error into a 409 with a sentence a person can
 * act on.
 *
 * Signing up with an address that already had an account produced a bare
 * "Internal server error" — the database was refusing a duplicate, which is a
 * perfectly ordinary answer, but it reached the user as though the site had
 * broken. Returns null for anything that isn't a unique violation, so genuine
 * failures still surface as 500s.
 */
function uniqueViolation(exception: unknown): string | null {
  const error = exception as { code?: string; meta?: { target?: unknown } };
  if (error?.code !== 'P2002') return null;

  const target = error.meta?.target;
  const fields = Array.isArray(target) ? target.map(String) : typeof target === 'string' ? [target] : [];
  const label = fields.map((field) => UNIQUE_FIELD_LABELS[field] ?? field).join(' and ');

  return label ? `That ${label} is already taken.` : 'That value is already taken.';
}
