# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-04-04

### Initial Release

First stable release of the My-SaaS Framework - a production-ready multi-tenant SaaS boilerplate.

### Added

#### Core Infrastructure
- **Multi-tenant Architecture** with schema-per-tenant isolation
- **Row-Level Security (RLS)** policies for defense-in-depth data isolation
- **TenantAwarePrismaService** for automatic schema switching
- **AsyncLocalStorage** context for request-scoped tenant tracking

#### Authentication & Authorization
- **JWT Authentication** with access tokens (15min) and refresh tokens (7d)
- **HttpOnly Cookies** for secure refresh token storage
- **Refresh Token Rotation** with automatic revocation of old tokens
- **Role-Based Access Control** (OWNER, ADMIN, MEMBER, VIEWER)
- **Guards**: JwtAuthGuard, TenantGuard, RolesGuard, LoginThrottlerGuard
- **Decorators**: @Public, @CurrentUser, @CurrentTenant, @Roles

#### API Features
- **NestJS 10** with modular architecture
- **Prisma 5** ORM with PostgreSQL 16
- **Swagger/OpenAPI** documentation at /api/docs
- **Global Validation Pipe** with whitelist and transform
- **Rate Limiting** with multiple throttle profiles (3/1s, 20/10s, 100/60s)
- **CORS** with strict origin validation in production

#### Modules
- **Auth Module**: register, login, logout, refresh, switch-tenant
- **Users Module**: profile management, tenant listing
- **Tenants Module**: create, update, invite members, manage roles
- **Health Module**: database health check endpoint

#### Caching & Performance
- **Redis 7** for caching with in-memory fallback
- **JWT Validation Caching** to reduce database queries
- **Cache-aside Pattern** implementation

#### Observability
- **Structured JSON Logging** for production
- **Correlation IDs** for request tracing
- **Audit Logging** for sensitive operations
- **Request Context** propagation (userId, tenantId)

#### Frontend
- **Next.js 14** with App Router
- **Zustand** for state management
- **Axios** with interceptors for auth
- **Tailwind CSS** for styling
- **SessionStorage** for secure token storage

#### DevOps & Infrastructure
- **Turbo Monorepo** configuration
- **Docker** multi-stage builds with non-root users
- **Docker Compose** for development and production
- **Traefik** reverse proxy with Let's Encrypt TLS
- **GitHub Actions** CI/CD pipeline
  - Lint, test, build jobs
  - Security scanning with Trivy
  - Deploy workflows for DEV and PROD

#### Database
- **Prisma Schema** with User, Tenant, TenantMember, RefreshToken, AuditLog
- **Safe Migration Scripts** with automatic backup
- **RLS Migration** with helper functions

#### Security Features
- Password hashing with bcrypt (12 rounds)
- Input validation with class-validator
- Mass assignment protection via DTOs
- OWNER role protection in invites
- SQL injection prevention
- Security headers configuration

### Framework Structure

```
my-saas/
├── apps/
│   ├── api/          # NestJS Backend
│   └── web/          # Next.js Frontend
├── packages/         # Shared packages
├── infra/           # Docker, Traefik, Scripts
└── .github/         # CI/CD workflows
```

### Extension Points

The following features are scaffolded for implementation:
- Email verification flow
- Password reset flow
- 2FA/MFA authentication
- Billing/subscriptions integration
- File uploads
- Notifications system

### Known Limitations

- Refresh tokens stored in plain text (recommend hashing)
- Health check does not verify Redis
- Limited test coverage (examples provided)
- Frontend is a basic scaffold

### Migration Guide

This is the initial release. For new projects:

1. Clone the repository
2. Copy environment files
3. Start Docker services
4. Run database migrations
5. Start development servers

See README.md for detailed instructions.

---

## [Unreleased]

### Planned
- Email verification scaffold
- Password reset scaffold
- Stripe integration example
- S3 file upload example
- WebSocket support
- BullMQ background jobs
- Admin dashboard scaffold
