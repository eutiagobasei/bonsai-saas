import { Logger } from '@nestjs/common';

const logger = new Logger('EnvValidation');

const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
];

const REQUIRED_PROD_ENV_VARS = [
  'CORS_ORIGINS',
  'REDIS_URL',
];

export function validateEnvironment(): void {
  const missing: string[] = [];
  const nodeEnv = process.env.NODE_ENV || 'development';

  for (const envVar of REQUIRED_ENV_VARS) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }

  if (nodeEnv === 'production') {
    for (const envVar of REQUIRED_PROD_ENV_VARS) {
      if (!process.env[envVar]) {
        missing.push(envVar);
      }
    }
  }

  if (missing.length > 0) {
    const message = `Missing required environment variables: ${missing.join(', ')}`;
    logger.error(message);
    throw new Error(message);
  }

  logger.log('Environment validation passed');
}
