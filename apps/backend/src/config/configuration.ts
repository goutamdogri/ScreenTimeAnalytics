export interface DatabaseConfig {
  url: string;
}

export interface JwtConfig {
  accessSecret: string;
  accessTtl: string;
  refreshSecret: string;
  refreshTtl: string;
}

export interface CorsConfig {
  origins: string[];
}

export interface AppConfig {
  nodeEnv: string;
  isProduction: boolean;
  port: number;
  database: DatabaseConfig;
  jwt: JwtConfig;
  cors: CorsConfig;
}

/**
 * Typed application configuration, loaded from environment variables by
 * `@nestjs/config`. Values are read from `process.env` — which `dotenv`
 * (through `ConfigModule`) has already populated from `.env` files.
 */
export default (): AppConfig => {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const isProduction = nodeEnv === 'production';

  return {
    nodeEnv,
    isProduction,
    port: parsePort(process.env.PORT),
    database: {
      url: process.env.DATABASE_URL ?? '',
    },
    jwt: {
      accessSecret:
        process.env.JWT_ACCESS_SECRET ??
        (isProduction ? '' : 'dev-insecure-jwt-access-secret-change-me'),
      accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
      refreshSecret:
        process.env.JWT_REFRESH_SECRET ??
        (isProduction ? '' : 'dev-insecure-jwt-refresh-secret-change-me'),
      refreshTtl: process.env.JWT_REFRESH_TTL ?? '7d',
    },
    cors: {
      origins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    },
  };
};

function parsePort(value: string | undefined): number {
  if (!value) {
    return 3000;
  }
  const port = Number.parseInt(value, 10);
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : 3000;
}
