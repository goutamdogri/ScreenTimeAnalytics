const REQUIRED_IN_PRODUCTION = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const;
const REQUIRED_ALWAYS = ['DATABASE_URL'] as const;

/**
 * Validates the raw environment variable map at application startup.
 *
 * Fails fast with a descriptive message instead of letting a misconfigured
 * service boot into runtime failures (design doc §8.2 — schema validation and
 * fail-fast setup).
 */
export function validateEnvironment(config: Record<string, unknown>): Record<string, unknown> {
  const nodeEnv = typeof config.NODE_ENV === 'string' ? config.NODE_ENV : 'development';
  const isProduction = nodeEnv === 'production';

  const required = isProduction ? REQUIRED_IN_PRODUCTION : REQUIRED_ALWAYS;
  const missing = required.filter(
    (key) => typeof config[key] !== 'string' || !(config[key] as string).trim(),
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}. ` +
        'Set them (see .env.example) before starting the backend.',
    );
  }

  const databaseUrl = config.DATABASE_URL as string;
  if (!databaseUrl.startsWith('postgresql://') && !databaseUrl.startsWith('postgres://')) {
    throw new Error(
      'DATABASE_URL must be a valid PostgreSQL connection string (postgresql://...).',
    );
  }

  const port = config.PORT;
  if (port !== undefined && port !== '') {
    const parsed = Number.parseInt(String(port), 10);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
      throw new Error(`PORT must be an integer between 1 and 65535, got "${String(port)}".`);
    }
  }

  return config;
}
