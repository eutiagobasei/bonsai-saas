import { ConfigService } from '@nestjs/config';
import { CookieOptions } from 'express';

export interface TokenCookieConfig {
  accessToken: CookieOptions;
  refreshToken: CookieOptions;
}

export function getTokenCookieConfig(configService: ConfigService): TokenCookieConfig {
  const isProduction = configService.get<string>('NODE_ENV') === 'production';
  const secureCookie = isProduction;

  // Access token: short-lived, sent with all API requests
  const accessTokenConfig: CookieOptions = {
    httpOnly: true,
    secure: secureCookie,
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000, // 15 minutes
    path: '/api',
  };

  // Refresh token: long-lived, only sent to /api/auth
  const refreshTokenConfig: CookieOptions = {
    httpOnly: true,
    secure: secureCookie,
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/api/auth',
  };

  return {
    accessToken: accessTokenConfig,
    refreshToken: refreshTokenConfig,
  };
}

export const COOKIE_NAMES = {
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
} as const;
