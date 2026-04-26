# Security Framework

Enterprise-grade security implementation following the **SaaS REST Security 10/10 Checklist**.

## Overview

The security framework is located in `apps/api/src/common/security/` and provides:

- Argon2id password hashing
- Session management with device tracking
- Refresh token rotation with reuse detection
- CSRF protection
- Multi-tenant isolation
- Input validation & pagination security
- Idempotency support
- File upload security
- Webhook security
- API key management
- Audit logging
- LGPD compliance (Brazilian data protection)

---

## 1. Password Hashing (Argon2id)

**File:** `apps/api/src/common/security/argon2.service.ts`

Argon2id is the winner of the Password Hashing Competition (2015) and recommended by OWASP.

### Configuration

```typescript
import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

@Injectable()
export class Argon2Service {
  private readonly hashOptions: argon2.Options = {
    type: argon2.argon2id,  // Hybrid: resistant to side-channel and GPU attacks
    memoryCost: 65536,      // 64MB (OWASP recommended)
    timeCost: 3,            // 3 iterations
    parallelism: 4,         // 4 parallel threads
  };

  async hash(password: string): Promise<string> {
    return argon2.hash(password, this.hashOptions);
  }

  async verify(hash: string, password: string): Promise<boolean> {
    return argon2.verify(hash, password);
  }
}
```

### Migration from bcrypt

```typescript
async migrateFromBcrypt(
  bcryptHash: string,
  password: string,
): Promise<string | null> {
  const bcrypt = await import('bcrypt');
  const isValid = await bcrypt.compare(password, bcryptHash);

  if (isValid) {
    return this.hash(password);  // Return new Argon2 hash
  }
  return null;
}

detectHashType(hash: string): 'argon2' | 'bcrypt' | 'unknown' {
  if (hash.startsWith('$argon2')) return 'argon2';
  if (hash.startsWith('$2a$') || hash.startsWith('$2b$')) return 'bcrypt';
  return 'unknown';
}
```

### Usage in AuthService

```typescript
// During login, auto-migrate bcrypt to argon2
const hashType = this.argon2Service.detectHashType(user.passwordHash);

if (hashType === 'bcrypt') {
  const newHash = await this.argon2Service.migrateFromBcrypt(
    user.passwordHash,
    password,
  );
  if (newHash) {
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });
  }
}
```

---

## 2. Session Management

**File:** `apps/api/src/common/security/session.service.ts`

Sessions track user devices and enable per-device logout.

### Prisma Schema

```prisma
model Session {
  id           String     @id @default(cuid())
  userId       String     @map("user_id")
  tenantId     String?    @map("tenant_id")
  deviceName   String?    // "Chrome on MacOS"
  deviceType   String?    // "desktop", "mobile", "tablet"
  browser      String?
  os           String?
  ipAddress    String?
  userAgent    String?
  expiresAt    DateTime   @map("expires_at")
  lastActiveAt DateTime   @default(now())
  revokedAt    DateTime?  @map("revoked_at")

  refreshTokens RefreshToken[]
  user         User       @relation(fields: [userId], references: [id])
}
```

### Creating a Session

```typescript
async createSession(
  userId: string,
  tenantId: string | null,
  request: Request,
): Promise<Session> {
  const userAgent = request.headers['user-agent'] || '';
  const ip = this.extractIpAddress(request);
  const deviceInfo = this.parseUserAgent(userAgent);

  return this.prisma.session.create({
    data: {
      userId,
      tenantId,
      deviceName: deviceInfo.deviceName,
      deviceType: deviceInfo.deviceType,
      browser: deviceInfo.browser,
      os: deviceInfo.os,
      ipAddress: ip,
      userAgent,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });
}
```

### Get All User Sessions

```typescript
async getUserSessions(userId: string): Promise<Session[]> {
  return this.prisma.session.findMany({
    where: {
      userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { lastActiveAt: 'desc' },
  });
}
```

### Revoke Session (Logout from Device)

```typescript
async revokeSession(sessionId: string, userId: string): Promise<void> {
  await this.prisma.session.updateMany({
    where: { id: sessionId, userId },
    data: { revokedAt: new Date() },
  });

  // Also revoke all refresh tokens for this session
  await this.prisma.refreshToken.updateMany({
    where: { sessionId },
    data: { revokedAt: new Date(), revokedReason: 'logout' },
  });
}
```

### Revoke All Other Sessions

```typescript
async revokeAllOtherSessions(
  userId: string,
  currentSessionId: string,
): Promise<void> {
  await this.prisma.session.updateMany({
    where: {
      userId,
      id: { not: currentSessionId },
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });
}
```

---

## 3. Refresh Token Rotation

**File:** `apps/api/src/modules/auth/auth.service.ts`

Implements token rotation with reuse detection to prevent token theft.

### Prisma Schema

```prisma
model RefreshToken {
  id            String     @id @default(cuid())
  token         String     @unique
  tokenHash     String     @map("token_hash")
  familyId      String     @map("family_id")  // Token family for reuse detection
  userId        String     @map("user_id")
  tenantId      String?    @map("tenant_id")
  sessionId     String?    @map("session_id")
  expiresAt     DateTime   @map("expires_at")
  createdAt     DateTime   @default(now())
  revokedAt     DateTime?  @map("revoked_at")
  revokedReason String?    // "rotation", "logout", "reuse_detected"

  @@index([familyId])
}
```

### Token Rotation Flow

```typescript
async refreshTokens(refreshToken: string): Promise<TokenPair> {
  const tokenRecord = await this.prisma.refreshToken.findUnique({
    where: { token: refreshToken },
  });

  if (!tokenRecord) {
    throw new UnauthorizedException('Invalid refresh token');
  }

  // Check if token was already revoked (potential reuse attack)
  if (tokenRecord.revokedAt) {
    // SECURITY: Revoke entire token family
    await this.revokeTokenFamily(tokenRecord.familyId);

    await this.auditService.log({
      action: 'LOGIN_FAILED',
      userId: tokenRecord.userId,
      metadata: { reason: 'refresh_token_reuse' },
    });

    throw new UnauthorizedException('Token reuse detected');
  }

  // Check expiration
  if (tokenRecord.expiresAt < new Date()) {
    throw new UnauthorizedException('Refresh token expired');
  }

  // Revoke old token (rotation)
  await this.prisma.refreshToken.update({
    where: { id: tokenRecord.id },
    data: { revokedAt: new Date(), revokedReason: 'rotation' },
  });

  // Create new token pair (same family)
  return this.createTokens(
    tokenRecord.userId,
    tokenRecord.tenantId,
    tokenRecord.sessionId,
    tokenRecord.familyId,  // Keep same family
  );
}
```

### Revoking Token Family

```typescript
private async revokeTokenFamily(familyId: string): Promise<void> {
  await this.prisma.refreshToken.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: 'reuse_detected' },
  });
}
```

---

## 4. CSRF Protection

**File:** `apps/api/src/common/security/origin-validation.guard.ts`

### Origin Validation Guard

```typescript
@Injectable()
export class OriginValidationGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const origin = request.headers.origin;

    const allowedOrigins = this.configService
      .get<string>('CORS_ORIGINS', '')
      .split(',')
      .map(o => o.trim());

    if (!origin || allowedOrigins.includes(origin)) {
      return true;
    }

    throw new ForbiddenException('Invalid origin');
  }
}
```

### Cookie Configuration

**File:** `apps/api/src/common/security/cookie-config.ts`

```typescript
export const cookieConfig = {
  httpOnly: true,      // Prevents XSS token theft
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',  // CSRF protection
  maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days
  path: '/',
};
```

---

## 5. Multi-Tenant Isolation

**File:** `apps/api/src/common/security/tenant-middleware.service.ts`

### Prisma Middleware for Tenant Filtering

```typescript
@Injectable()
export class TenantMiddlewareService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  onModuleInit() {
    this.prisma.$use(async (params, next) => {
      const tenantId = this.getCurrentTenantId();

      if (!tenantId) return next(params);

      // Models that require tenant filtering
      const tenantModels = [
        'Supply', 'SupplyCategory', 'Recipe',
        'Supplier', 'Order', 'Invoice'
      ];

      if (!tenantModels.includes(params.model)) {
        return next(params);
      }

      // Inject tenantId filter
      if (['findMany', 'findFirst', 'findUnique'].includes(params.action)) {
        params.args = params.args || {};
        params.args.where = { ...params.args.where, tenantId };
      }

      if (params.action === 'create') {
        params.args.data = { ...params.args.data, tenantId };
      }

      return next(params);
    });
  }
}
```

### Database Schema Isolation

```
PostgreSQL Database
├── public schema (shared)
│   ├── users
│   ├── tenants
│   ├── tenant_members
│   └── sessions
│
├── tenant_{tenant_id} (isolated per tenant)
│   ├── supplies
│   ├── supply_categories
│   ├── recipes
│   └── ...tenant-specific tables
```

---

## 6. Input Validation & Pagination

**File:** `apps/api/src/common/crud/base-crud.service.ts`

### Pagination Limits (DoS Prevention)

```typescript
export const PAGINATION_LIMITS = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,  // Prevents memory exhaustion
  DEFAULT_PAGE: 1,
} as const;

interface PaginationOptions {
  page?: number;
  limit?: number;
}

function sanitizePagination(options: PaginationOptions) {
  return {
    page: Math.max(1, options.page || PAGINATION_LIMITS.DEFAULT_PAGE),
    limit: Math.min(
      PAGINATION_LIMITS.MAX_PAGE_SIZE,
      Math.max(1, options.limit || PAGINATION_LIMITS.DEFAULT_PAGE_SIZE)
    ),
  };
}
```

### DTO Whitelisting

```typescript
// main.ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,           // Strip non-whitelisted properties
    forbidNonWhitelisted: true, // Throw on unknown properties
    transform: true,
  }),
);
```

---

## 7. Idempotency

**File:** `apps/api/src/common/security/idempotency.interceptor.ts`

Prevents duplicate resource creation on network retries.

```typescript
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private cacheService: CacheService) {}

  async intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();
    const idempotencyKey = request.headers['idempotency-key'];

    if (!idempotencyKey || request.method !== 'POST') {
      return next.handle();
    }

    // Check if we've already processed this request
    const cachedResponse = await this.cacheService.get(
      `idempotency:${idempotencyKey}`
    );

    if (cachedResponse) {
      return of(cachedResponse);
    }

    return next.handle().pipe(
      tap(async (response) => {
        await this.cacheService.set(
          `idempotency:${idempotencyKey}`,
          response,
          24 * 60 * 60,  // 24 hours
        );
      }),
    );
  }
}
```

### Client Usage

```typescript
const response = await fetch('/api/orders', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Idempotency-Key': crypto.randomUUID(),  // Unique per request
  },
  body: JSON.stringify(orderData),
});
```

---

## 8. File Upload Security

**File:** `apps/api/src/common/security/upload.guard.ts`

### MIME Type & Magic Bytes Validation

```typescript
@Injectable()
export class UploadGuard implements CanActivate {
  private readonly allowedMimeTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];

  private readonly MAGIC_BYTES: Record<string, number[]> = {
    'image/jpeg': [0xff, 0xd8, 0xff],
    'image/png': [0x89, 0x50, 0x4e, 0x47],
    'image/gif': [0x47, 0x49, 0x46, 0x38],
    'application/pdf': [0x25, 0x50, 0x44, 0x46],
  };

  private readonly DANGEROUS_EXTENSIONS = [
    '.exe', '.bat', '.cmd', '.sh', '.php', '.js',
    '.py', '.rb', '.pl', '.ps1', '.vbs', '.jar',
    '.dll', '.so', '.app',
  ];

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const file = request.file;

    if (!file) return true;

    // Check MIME type
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('File type not allowed');
    }

    // Check magic bytes (file signature)
    const expectedBytes = this.MAGIC_BYTES[file.mimetype];
    if (expectedBytes) {
      const fileBytes = new Uint8Array(file.buffer.slice(0, expectedBytes.length));
      const isValid = expectedBytes.every((byte, i) => byte === fileBytes[i]);

      if (!isValid) {
        throw new BadRequestException('File signature mismatch');
      }
    }

    // Check dangerous extensions
    const ext = path.extname(file.originalname).toLowerCase();
    if (this.DANGEROUS_EXTENSIONS.includes(ext)) {
      throw new BadRequestException('File extension not allowed');
    }

    return true;
  }
}
```

---

## 9. Webhook Security

**File:** `apps/api/src/common/security/webhook.service.ts`

### HMAC Signature Validation

```typescript
@Injectable()
export class WebhookService {
  constructor(private configService: ConfigService) {}

  private readonly SECRET = this.configService.get('WEBHOOK_SECRET');

  generateSignature(payload: string, timestamp: number): string {
    const message = `${timestamp}.${payload}`;
    return crypto
      .createHmac('sha256', this.SECRET)
      .update(message)
      .digest('hex');
  }

  verifySignature(
    payload: string,
    signature: string,
    timestamp: number,
  ): boolean {
    const expectedSignature = this.generateSignature(payload, timestamp);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    );
  }

  validateTimestamp(timestamp: number): boolean {
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    return Math.abs(now - timestamp) < fiveMinutes;  // Replay protection
  }
}
```

### Webhook Delivery with Retry

```typescript
async deliverWebhook(
  endpoint: string,
  payload: object,
  maxRetries = 3,
): Promise<void> {
  const timestamp = Date.now();
  const payloadString = JSON.stringify(payload);
  const signature = this.generateSignature(payloadString, timestamp);

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Timestamp': timestamp.toString(),
        },
        body: payloadString,
      });
      return;  // Success
    } catch (error) {
      const delay = Math.pow(2, attempt) * 1000;  // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error('Webhook delivery failed after retries');
}
```

---

## 10. API Keys

**File:** `apps/api/src/common/security/api-keys.service.ts`

### Prisma Schema

```prisma
model ApiKey {
  id           String     @id @default(cuid())
  userId       String     @map("user_id")
  name         String
  prefix       String     // "mysk_" for identification
  hashedKey    String     @map("hashed_key")
  scopes       String[]   // ["read:supplies", "write:categories"]
  expiresAt    DateTime?  @map("expires_at")
  lastUsedAt   DateTime?  @map("last_used_at")
  createdAt    DateTime   @default(now())
  revokedAt    DateTime?  @map("revoked_at")

  user         User       @relation(fields: [userId], references: [id])
}
```

### Creating API Keys

```typescript
async createApiKey(
  userId: string,
  name: string,
  scopes: string[],
  expiresIn?: number,
): Promise<{ key: string; record: ApiKey }> {
  const rawKey = crypto.randomBytes(32).toString('hex');
  const prefix = 'mysk_';
  const fullKey = `${prefix}${rawKey}`;
  const hashedKey = await this.argon2Service.hash(rawKey);

  const record = await this.prisma.apiKey.create({
    data: {
      userId,
      name,
      prefix,
      hashedKey,
      scopes,
      expiresAt: expiresIn
        ? new Date(Date.now() + expiresIn)
        : null,
    },
  });

  return { key: fullKey, record };  // Return full key only once
}
```

### API Key Guard

```typescript
@Injectable()
export class ApiKeyGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = this.extractApiKey(request);

    if (!apiKey) return false;

    const [prefix, rawKey] = this.parseApiKey(apiKey);

    const keyRecord = await this.prisma.apiKey.findFirst({
      where: { prefix, revokedAt: null },
    });

    if (!keyRecord) return false;

    const isValid = await this.argon2Service.verify(keyRecord.hashedKey, rawKey);
    if (!isValid) return false;

    // Check expiration
    if (keyRecord.expiresAt && keyRecord.expiresAt < new Date()) {
      return false;
    }

    // Update last used
    await this.prisma.apiKey.update({
      where: { id: keyRecord.id },
      data: { lastUsedAt: new Date() },
    });

    request.apiKey = keyRecord;
    return true;
  }
}
```

---

## 11. Audit Logging

**File:** `apps/api/src/common/security/audit.service.ts`

### Audit Actions

```typescript
type AuditAction =
  | 'LOGIN' | 'LOGIN_FAILED' | 'LOGOUT' | 'REGISTER'
  | 'PASSWORD_CHANGE' | 'MFA_ENABLED' | 'MFA_DISABLED'
  | 'CREATE' | 'UPDATE' | 'DELETE' | 'EXPORT' | 'IMPORT'
  | 'BILLING_UPDATE' | 'PERMISSION_CHANGE'
  | 'API_KEY_CREATED' | 'API_KEY_REVOKED'
  | 'DATA_DELETION_REQUEST' | 'CONSENT_GRANTED' | 'CONSENT_REVOKED';
```

### Logging Events

```typescript
@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(params: {
    action: AuditAction;
    userId?: string;
    tenantId?: string;
    entityType?: string;
    entityId?: string;
    oldData?: object;
    newData?: object;
    ipAddress?: string;
    userAgent?: string;
    metadata?: object;
  }): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        action: params.action,
        userId: params.userId,
        tenantId: params.tenantId,
        entityType: params.entityType,
        entityId: params.entityId,
        oldData: params.oldData ? JSON.stringify(params.oldData) : null,
        newData: params.newData ? JSON.stringify(params.newData) : null,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
        createdAt: new Date(),
      },
    });
  }
}
```

### Usage Example

```typescript
// In AuthService
async login(email: string, password: string, request: Request) {
  const user = await this.validateUser(email, password);

  if (!user) {
    await this.auditService.log({
      action: 'LOGIN_FAILED',
      metadata: { email, reason: 'invalid_credentials' },
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
    throw new UnauthorizedException();
  }

  await this.auditService.log({
    action: 'LOGIN',
    userId: user.id,
    tenantId: user.tenantId,
    ipAddress: request.ip,
    userAgent: request.headers['user-agent'],
  });

  return this.createTokens(user);
}
```

---

## 12. LGPD Compliance

**File:** `apps/api/src/common/security/lgpd.service.ts`

Brazilian General Data Protection Law (Lei Geral de Proteção de Dados).

### Consent Management

```typescript
async recordConsent(
  userId: string,
  type: ConsentType,
  granted: boolean,
): Promise<void> {
  await this.prisma.consentRecord.create({
    data: { userId, type, granted },
  });

  await this.auditService.log({
    action: granted ? 'CONSENT_GRANTED' : 'CONSENT_REVOKED',
    userId,
    metadata: { consentType: type },
  });
}

async getUserConsents(userId: string): Promise<ConsentRecord[]> {
  return this.prisma.consentRecord.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}
```

### Data Deletion Request

```typescript
async requestDataDeletion(userId: string): Promise<DataDeletionRequest> {
  const gracePeriod = new Date();
  gracePeriod.setDate(gracePeriod.getDate() + 7);  // 7-day grace period

  const request = await this.prisma.dataDeletionRequest.create({
    data: {
      userId,
      status: 'PENDING',
      gracePeriod,
    },
  });

  await this.auditService.log({
    action: 'DATA_DELETION_REQUEST',
    userId,
    entityId: request.id,
  });

  return request;
}

async executeDataDeletion(requestId: string): Promise<void> {
  const request = await this.prisma.dataDeletionRequest.findUnique({
    where: { id: requestId },
  });

  if (request.gracePeriod > new Date()) {
    throw new Error('Grace period not yet expired');
  }

  // Delete user data in cascading order
  await this.prisma.$transaction([
    this.prisma.refreshToken.deleteMany({ where: { userId: request.userId } }),
    this.prisma.session.deleteMany({ where: { userId: request.userId } }),
    this.prisma.apiKey.deleteMany({ where: { userId: request.userId } }),
    // ... delete tenant-specific data
    this.prisma.user.delete({ where: { id: request.userId } }),
  ]);

  await this.prisma.dataDeletionRequest.update({
    where: { id: requestId },
    data: { status: 'COMPLETED', completedAt: new Date() },
  });
}
```

### Data Export (Portability)

```typescript
async exportUserData(userId: string): Promise<object> {
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
    include: {
      sessions: true,
      refreshTokens: true,
      tenantMembers: { include: { tenant: true } },
    },
  });

  // Remove sensitive fields
  const { passwordHash, mfaSecret, ...safeUser } = user;

  return {
    exportedAt: new Date().toISOString(),
    user: safeUser,
    consents: await this.getUserConsents(userId),
    auditLogs: await this.prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    }),
  };
}
```

---

## Security Module Registration

**File:** `apps/api/src/common/security/security.module.ts`

```typescript
@Global()
@Module({
  providers: [
    Argon2Service,
    SessionService,
    AuditService,
    WebhookService,
    ApiKeysService,
    LgpdService,
    EncryptionService,
    TenantMiddlewareService,
    {
      provide: APP_INTERCEPTOR,
      useClass: IdempotencyInterceptor,
    },
  ],
  exports: [
    Argon2Service,
    SessionService,
    AuditService,
    WebhookService,
    ApiKeysService,
    LgpdService,
    EncryptionService,
    TenantMiddlewareService,
  ],
})
export class SecurityModule {}
```

---

## Quick Reference

| Feature | File | Key Method |
|---------|------|------------|
| Password Hashing | `argon2.service.ts` | `hash()`, `verify()` |
| Sessions | `session.service.ts` | `createSession()`, `revokeSession()` |
| Token Rotation | `auth.service.ts` | `refreshTokens()` |
| CSRF | `origin-validation.guard.ts` | `canActivate()` |
| Tenant Isolation | `tenant-middleware.service.ts` | Prisma middleware |
| File Upload | `upload.guard.ts` | Magic bytes validation |
| Webhooks | `webhook.service.ts` | `verifySignature()` |
| API Keys | `api-keys.service.ts` | `createApiKey()` |
| Audit Logs | `audit.service.ts` | `log()` |
| LGPD | `lgpd.service.ts` | `requestDataDeletion()` |
