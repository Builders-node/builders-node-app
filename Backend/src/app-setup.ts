/**
 * Shared application configuration used by BOTH runtime entrypoints
 * (`src/main.ts` for a long-running server and `api/index.ts` for the Vercel
 * lambda) so CORS, validation and body limits can never drift apart.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const LOCALHOST_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
];

/** Uploads are base64-encoded, so bodies are ~33% larger than the file. */
export const BODY_LIMIT = '5mb';

type OriginCallback = (err: Error | null, allow?: boolean) => void;

/**
 * Builds the CORS `origin` predicate.
 *
 * Always allowed: the configured FRONTEND_URL(s), localhost dev servers, and any
 * `*.buildersnode.com` host. `*.vercel.app` origins are allowed only when
 * `ALLOW_VERCEL_ORIGINS` is not explicitly `"false"` — set it to `false` once the
 * app is fully served from the custom domain to close the "any Vercel project can
 * make credentialed requests" hole.
 */
export function makeCorsOrigin(config: ConfigService) {
  const frontendUrls = (config.get<string>('FRONTEND_URL') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const extraOrigins = (config.get<string>('CORS_EXTRA_ORIGINS') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const allowlist = new Set([...frontendUrls, ...extraOrigins, ...LOCALHOST_ORIGINS]);
  const allowVercel = config.get<string>('ALLOW_VERCEL_ORIGINS') !== 'false';

  return (origin: string | undefined, cb: OriginCallback) => {
    // Non-browser clients (curl, server-to-server) send no Origin header.
    if (!origin) return cb(null, true);
    if (allowlist.has(origin)) return cb(null, true);

    let host = '';
    try {
      host = new URL(origin).hostname;
    } catch {
      return cb(null, false);
    }

    const ok =
      host === 'buildersnode.com' ||
      host.endsWith('.buildersnode.com') ||
      (allowVercel && (host === 'vercel.app' || host.endsWith('.vercel.app')));
    cb(null, ok);
  };
}

/** Applies the global CORS + validation config shared by both entrypoints. */
export function applyGlobalConfig(app: INestApplication, config: ConfigService): void {
  app.enableCors({ origin: makeCorsOrigin(config), credentials: true });
  // whitelist strips unknown props (prevents mass-assignment); we intentionally
  // do NOT set forbidNonWhitelisted so a stray extra field is dropped, not a 400.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
}
