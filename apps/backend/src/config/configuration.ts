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

export interface EncryptionConfig {
  masterKey: string;
}

export interface LlmConfigSetting {
  ollamaUrl: string;
}

export interface ClassificationConfig {
  workerEnabled: boolean;
  pollIntervalMs: number;
  batchSize: number;
}

export interface SessionsConfig {
  finalizerEnabled: boolean;
  pollIntervalMs: number;
  /**
   * How old (ms) a window's last event must be before the finalizer closes the
   * session: 2× the session gap, so a buffered/offline agent burst reconnecting
   * late can never split one session into two.
   */
  settleMs: number;
}

export interface AppConfig {
  nodeEnv: string;
  isProduction: boolean;
  port: number;
  database: DatabaseConfig;
  jwt: JwtConfig;
  cors: CorsConfig;
  encryption: EncryptionConfig;
  llm: LlmConfigSetting;
  classification: ClassificationConfig;
  sessions: SessionsConfig;
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
    encryption: {
      // Base64 of 32 random bytes — `openssl rand -base64 32` (design doc §3.3).
      // Required in production (see validation.ts); dev falls back to a derived
      // key so local/e2e runs work without configuration.
      masterKey: process.env.ENCRYPTION_MASTER_KEY ?? '',
    },
    llm: {
      ollamaUrl: process.env.LLM_OLLAMA_URL ?? 'http://localhost:11434',
    },
    classification: {
      workerEnabled: !['1', 'true', 'yes'].includes(
        (process.env.CLASSIFICATION_WORKER_DISABLED ?? 'false').toLowerCase(),
      ),
      pollIntervalMs: parseInteger(process.env.CLASSIFICATION_POLL_MS, 30_000),
      batchSize: parseInteger(process.env.CLASSIFICATION_BATCH_SIZE, 50),
    },
    sessions: {
      finalizerEnabled: !['1', 'true', 'yes'].includes(
        (process.env.SESSION_FINALIZER_DISABLED ?? 'false').toLowerCase(),
      ),
      pollIntervalMs: parseInteger(process.env.SESSION_FINALIZER_POLL_MS, 30_000),
      settleMs: parseInteger(process.env.SESSION_FINALIZER_SETTLE_MS, 600_000),
    },
  };
};

function parsePort(value: string | undefined): number {
  if (!value) {
    return 3000;
  }
  const port = Number.parseInt(value, 10);
  return Number.isInteger(port) && port >= 0 && port <= 65535 ? port : 3000;
}

function parseInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
