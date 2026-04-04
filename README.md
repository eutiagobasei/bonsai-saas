# My-SaaS Framework

A production-ready **multi-tenant SaaS framework** built with NestJS and Next.js. This is a **starter kit/boilerplate** designed to accelerate SaaS development with enterprise-grade patterns already in place.

## What is This?

My-SaaS is a **framework**, not a finished application. It provides:

- **Solid architectural foundation** for building multi-tenant SaaS applications
- **Security patterns** implemented correctly from day one
- **Extensible structure** that grows with your product
- **DevOps ready** infrastructure with CI/CD and Docker

You build your product features on top of this foundation.

## Framework Features

### Core Infrastructure (Ready to Use)

| Feature | Status | Description |
|---------|--------|-------------|
| Multi-tenant Architecture | ✅ Complete | Schema-per-tenant + Row-Level Security |
| Authentication | ✅ Complete | JWT with HttpOnly refresh tokens |
| Authorization | ✅ Complete | Role-based (Owner, Admin, Member, Viewer) |
| Rate Limiting | ✅ Complete | Global + per-endpoint throttling |
| Audit Logging | ✅ Complete | Track sensitive operations |
| Structured Logging | ✅ Complete | JSON logs with correlation IDs |
| Caching Layer | ✅ Complete | Redis with in-memory fallback |
| CI/CD Pipeline | ✅ Complete | GitHub Actions with security scanning |
| Docker Setup | ✅ Complete | Multi-stage builds, non-root users |
| Database Migrations | ✅ Complete | Safe Prisma workflows |

### Extension Points (You Implement)

| Feature | Status | Description |
|---------|--------|-------------|
| Email Verification | 📝 Scaffold | Add your email provider |
| Password Reset | 📝 Scaffold | Implement with your flow |
| 2FA/MFA | 📝 Scaffold | Optional security enhancement |
| Billing/Subscriptions | 📝 Scaffold | Integrate Stripe/Paddle |
| File Uploads | 📝 Scaffold | Add S3/Cloudflare R2 |
| Notifications | 📝 Scaffold | Email, push, in-app |
| Frontend Pages | 📝 Scaffold | Build your UI |

## Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Backend | NestJS | 10.x |
| Frontend | Next.js | 14.x |
| Database | PostgreSQL | 16 |
| ORM | Prisma | 5.x |
| Cache | Redis | 7.x |
| State | Zustand | 4.x |
| Styling | Tailwind CSS | 3.x |
| Build | Turbo (Monorepo) | 1.x |
| Container | Docker | Latest |
| Reverse Proxy | Traefik | Latest |

## Project Structure

```
my-saas/
├── .github/workflows/        # CI/CD pipelines
│   ├── ci.yml               # Lint, test, build, security scan
│   ├── deploy-dev.yml       # Deploy to DEV environment
│   └── deploy-prod.yml      # Deploy to PROD environment
│
├── apps/
│   ├── api/                  # NestJS Backend
│   │   ├── src/
│   │   │   ├── common/      # Shared: guards, decorators, interceptors
│   │   │   │   ├── guards/         # JwtAuthGuard, TenantGuard, RolesGuard
│   │   │   │   ├── decorators/     # @Public, @CurrentUser, @CurrentTenant
│   │   │   │   ├── interceptors/   # TenantInterceptor
│   │   │   │   ├── database/       # Prisma services, tenant-aware queries
│   │   │   │   ├── cache/          # Redis caching service
│   │   │   │   ├── logging/        # Structured JSON logger
│   │   │   │   └── audit/          # Audit log service
│   │   │   │
│   │   │   └── modules/     # Feature modules
│   │   │       ├── auth/           # Login, register, refresh, logout
│   │   │       ├── users/          # User profile management
│   │   │       ├── tenants/        # Tenant & member management
│   │   │       └── health/         # Health check endpoint
│   │   │
│   │   ├── prisma/          # Database schema & migrations
│   │   ├── test/            # Test files & fixtures
│   │   └── scripts/         # Migration & backup scripts
│   │
│   └── web/                  # Next.js Frontend
│       └── src/
│           ├── app/         # App Router pages
│           ├── components/  # React components
│           ├── hooks/       # Custom hooks (useAuth)
│           └── lib/         # API client, auth store
│
├── packages/                 # Shared packages (extend as needed)
│   ├── types/               # Shared TypeScript types
│   ├── ui/                  # Shared UI components
│   └── utils/               # Shared utilities
│
└── infra/
    ├── docker/              # Docker Compose (dev + prod)
    ├── traefik/             # Reverse proxy config
    └── scripts/             # Deploy, backup, setup scripts
```

## Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- npm 10+

### 1. Clone and Install

```bash
git clone https://github.com/your-username/my-saas.git
cd my-saas
npm install
```

### 2. Configure Environment

```bash
# API environment
cp apps/api/.env.example apps/api/.env

# Web environment
cp apps/web/.env.local.example apps/web/.env.local
```

### 3. Start Services

```bash
# Start PostgreSQL and Redis
npm run docker:up

# Run database migrations
npm run db:migrate

# Start development servers
npm run dev
```

### 4. Access

- **API:** http://localhost:3000
- **API Docs:** http://localhost:3000/api/docs
- **Web:** http://localhost:3001

## Multi-Tenant Architecture

### Schema-per-Tenant Isolation

```
PostgreSQL Database
├── public schema (shared)
│   ├── users
│   ├── tenants
│   ├── tenant_members
│   ├── refresh_tokens
│   └── audit_logs
│
├── tenant_acme_corp (isolated)
│   └── [your tenant-specific tables]
│
└── tenant_startup_xyz (isolated)
    └── [your tenant-specific tables]
```

### Defense in Depth

1. **Application Layer:** TenantGuard validates JWT tenant claims
2. **Database Layer:** Row-Level Security policies enforce isolation
3. **Schema Layer:** Each tenant has isolated PostgreSQL schema

### Using Tenant Context

```typescript
// Controller with tenant isolation
@Controller('products')
@UseGuards(TenantGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async findAll(@CurrentTenant() tenantId: string) {
    // tenantId is extracted from JWT and validated
    return this.productsService.findByTenant(tenantId);
  }

  @Post()
  @Roles('ADMIN', 'OWNER')
  @UseGuards(RolesGuard)
  async create(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateProductDto,
  ) {
    return this.productsService.create(tenantId, user.sub, dto);
  }
}
```

## Extending the Framework

### Adding a New Module

```bash
# 1. Generate NestJS module
cd apps/api
npx nest generate module modules/products
npx nest generate controller modules/products
npx nest generate service modules/products

# 2. Create DTOs with validation
# 3. Add Prisma models
# 4. Write tests
```

### Adding Email Verification (Example)

```typescript
// 1. Add to Prisma schema
model EmailVerificationToken {
  id        String   @id @default(cuid())
  token     String   @unique
  userId    String
  expiresAt DateTime
  user      User     @relation(fields: [userId], references: [id])
}

// 2. Create verification service
@Injectable()
export class EmailVerificationService {
  async sendVerification(userId: string, email: string) {
    const token = crypto.randomBytes(32).toString('hex');
    await this.prisma.emailVerificationToken.create({
      data: {
        token,
        userId,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    await this.emailService.send(email, 'verify', { token });
  }
}

// 3. Add endpoint
@Post('verify-email')
@Public()
async verifyEmail(@Body() dto: VerifyEmailDto) {
  return this.emailVerificationService.verify(dto.token);
}
```

### Adding a New Guard

```typescript
// src/common/guards/subscription.guard.ts
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const tenantId = request.user?.tenantId;

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { plan: true, status: true },
    });

    if (tenant?.status !== 'ACTIVE') {
      throw new ForbiddenException('Tenant is suspended');
    }

    return true;
  }
}
```

## Security Best Practices

### Already Implemented

- ✅ JWT tokens with short expiry (15min access, 7d refresh)
- ✅ HttpOnly cookies for refresh tokens
- ✅ bcrypt with 12 rounds for password hashing
- ✅ Rate limiting (3/1s, 20/10s, 100/60s)
- ✅ CORS with strict origin validation
- ✅ Input validation with class-validator
- ✅ SQL injection prevention (Prisma parameterized queries)
- ✅ Mass assignment protection (DTO whitelisting)

### Recommended Additions

```typescript
// Hash refresh tokens before storing (recommended)
const hashedToken = await bcrypt.hash(refreshToken, 10);
await this.prisma.refreshToken.create({
  data: { token: hashedToken, ... }
});

// Verify by comparing
const isValid = await bcrypt.compare(providedToken, storedHash);
```

## Database Commands

| Command | Environment | Description |
|---------|-------------|-------------|
| `npm run db:migrate` | Development | Create and apply migrations |
| `npm run db:migrate:prod` | Production | Apply existing migrations only |
| `npm run db:studio` | Development | Open Prisma Studio |
| `npm run db:reset:force` | Development | Reset database (destructive) |

## Deployment

### Prerequisites

1. VPS with Docker installed
2. Domain with DNS configured
3. GitHub secrets configured

### Deploy to Production

```bash
# Via GitHub Actions (recommended)
# Trigger deploy-prod.yml workflow with version tag

# Or manually
ssh user@your-vps
cd /opt/my-saas/prod
./deploy.sh v1.0.0
```

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `PROD_HOST` | Production VPS hostname |
| `PROD_USER` | SSH username |
| `PROD_SSH_KEY` | SSH private key |
| `PROD_API_URL` | https://api.yourdomain.com |

## Testing

```bash
# Run all tests
npm run test

# Run with coverage
npm run test:cov

# Run e2e tests
npm run test:e2e
```

## Scripts Reference

| Script | Location | Purpose |
|--------|----------|---------|
| `migrate-safe.sh` | `apps/api/scripts/` | Migration with automatic backup |
| `backup-db.sh` | `apps/api/scripts/` | Database backup |
| `restore-db.sh` | `apps/api/scripts/` | Restore from backup |
| `deploy.sh` | `infra/scripts/` | Deploy to VPS |
| `setup-vps.sh` | `infra/scripts/` | Initial VPS setup |
| `rotate-secret.sh` | `infra/scripts/` | Rotate secrets safely |

## Roadmap

- [ ] Email verification scaffold
- [ ] Password reset scaffold
- [ ] Stripe integration example
- [ ] File upload with S3
- [ ] WebSocket support
- [ ] Background jobs with BullMQ
- [ ] Admin dashboard

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on extending the framework.

## License

MIT License - See [LICENSE](LICENSE) for details.

---

**Built with** NestJS, Next.js, Prisma, PostgreSQL, Redis, Docker, and Traefik.
