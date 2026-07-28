/**
 * Boot-time environment validation.
 *
 * Passed to `ConfigModule.forRoot({ validate })`, so it runs before anything
 * else and aborts startup with a clear message if a required secret is missing.
 *
 * The whole point is to *fail fast* in production instead of silently falling
 * back to a publicly-known default secret (which would let anyone forge admin
 * tokens or unlock the admin API).
 */
const REQUIRED_IN_PRODUCTION = ['JWT_SECRET', 'ADMIN_ACCESS_KEY', 'DATABASE_URL'] as const;

// Values that must never be used in production, even if the env var is "set".
const FORBIDDEN_PRODUCTION_VALUES: Record<string, string> = {
  JWT_SECRET: 'local-development-secret',
  ADMIN_ACCESS_KEY: 'terminus-local-admin',
};

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const isProduction = config.NODE_ENV === 'production';
  if (!isProduction) {
    return config;
  }

  const problems: string[] = [];

  for (const key of REQUIRED_IN_PRODUCTION) {
    const value = config[key];
    if (typeof value !== 'string' || value.trim() === '') {
      problems.push(`${key} is required in production but is not set.`);
      continue;
    }
    const forbidden = FORBIDDEN_PRODUCTION_VALUES[key];
    if (forbidden && value === forbidden) {
      problems.push(`${key} is set to the insecure development default and must be changed in production.`);
    }
  }

  const jwtSecret = config.JWT_SECRET;
  if (typeof jwtSecret === 'string' && jwtSecret.trim() !== '' && jwtSecret.length < 32) {
    problems.push('JWT_SECRET must be at least 32 characters in production.');
  }

  if (problems.length > 0) {
    throw new Error(`Invalid production environment:\n- ${problems.join('\n- ')}`);
  }

  return config;
}
