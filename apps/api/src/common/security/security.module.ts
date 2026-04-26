import { Global, Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

// Core security
import { SecretsService } from './secrets.service';
import { EncryptionService } from './encryption.service';

// Password hashing
import { Argon2Service } from './argon2.service';

// Session management
import { SessionService } from './session.service';

// Audit logging
import { AuditService } from './audit.service';

// Multi-tenant middleware
import { TenantMiddlewareService } from './tenant-middleware.service';

// Guards and interceptors
import { OriginValidationGuard } from './origin-validation.guard';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { UploadGuard } from './upload.guard';

// Webhooks
import { WebhookService } from './webhook.service';

// API Keys
import { ApiKeysService, ApiKeyGuard } from './api-keys.service';

// LGPD compliance
import { LgpdService } from './lgpd.service';

const services = [
  SecretsService,
  EncryptionService,
  Argon2Service,
  SessionService,
  AuditService,
  TenantMiddlewareService,
  WebhookService,
  ApiKeysService,
  LgpdService,
];

const guards = [
  OriginValidationGuard,
  UploadGuard,
  ApiKeyGuard,
];

@Global()
@Module({
  providers: [
    ...services,
    ...guards,
    // Register idempotency interceptor globally
    {
      provide: APP_INTERCEPTOR,
      useClass: IdempotencyInterceptor,
    },
  ],
  exports: [
    ...services,
    ...guards,
  ],
})
export class SecurityModule {}
