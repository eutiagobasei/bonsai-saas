# My-SaaS

A production-ready multi-tenant SaaS boilerplate with NestJS backend and Next.js frontend.

## Features

- **Multi-tenant architecture** (Schema per tenant)
- **Secure authentication** (JWT with refresh tokens)
- **Role-based access control** (Owner, Admin, Member, Viewer)
- **Safe database migrations** (Protected Prisma workflows)
- **CI/CD ready** (GitHub Actions)
- **Docker-based deployment** (Traefik + Docker Compose)
- **Production security** (Rate limiting, HTTPS, security headers)

## Project Structure

```
saas-project/
├── .github/workflows/     # CI/CD pipelines
├── apps/
│   ├── api/               # NestJS Backend
│   │   ├── src/
│   │   │   ├── modules/   # Feature modules (auth, tenants, users)
│   │   │   └── common/    # Guards, decorators, interceptors
│   │   ├── prisma/        # Database schema & migrations
│   │   └── scripts/       # Migration scripts
│   └── web/               # Next.js Frontend
│       └── src/
│           ├── components/
│           ├── hooks/
│           └── lib/
├── packages/              # Shared code (monorepo)
└── infra/
    ├── docker/            # Docker Compose files
    ├── traefik/           # Traefik configuration
    └── scripts/           # Deploy, backup scripts
```

## Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- npm 10+

### Local Development

1. **Clone and install dependencies:**
   ```bash
   cd saas-project
   npm install
   ```

2. **Set up environment:**
   ```bash
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.local.example apps/web/.env.local
   ```

3. **Start Docker services:**
   ```bash
   npm run docker:up
   ```

4. **Run database migrations:**
   ```bash
   npm run db:migrate
   ```

5. **Start development servers:**
   ```bash
   npm run dev
   ```

   - API: http://localhost:3000
   - Web: http://localhost:3001

## Database Migrations

### Safe Migration Commands

| Command | Environment | Description |
|---------|-------------|-------------|
| `npm run db:migrate` | DEV | Creates and applies migrations |
| `npm run db:migrate:prod` | PROD | Only applies existing migrations |
| `npm run db:reset` | ANY | **BLOCKED** for safety |
| `npm run db:reset:force` | DEV | Forces reset (destructive) |

### Production Migration Safety

The `db:reset` command is blocked by default to prevent accidental data loss:

```bash
$ npm run db:reset

⚠️  BLOCKED: Database reset is disabled for safety.
   Use db:reset:force if you are absolutely sure.
   This will DELETE ALL DATA!
```

For production, **always** use `prisma migrate deploy`:
- Only applies existing migrations
- Never creates new ones
- Never prompts for reset

## Multi-Tenant Architecture

### Schema per Tenant

```
database: saas_prod
├── public (shared: users, tenants, billing)
├── tenant_abc123 (data for tenant ABC)
├── tenant_xyz789 (data for tenant XYZ)
└── ...
```

### Authentication Flow

1. User logs in with email/password
2. If single tenant → JWT includes `tenantId`
3. If multiple tenants → Redirect to tenant selection
4. All requests use `tenantId` from JWT for data isolation

### Backend Usage

```typescript
@Controller('products')
@UseGuards(TenantGuard)
export class ProductsController {
  @Get()
  findAll(@CurrentTenant() tenantId: string) {
    return this.productsService.findAllByTenant(tenantId);
  }
}
```

## Deployment

### VPS Setup

1. **Run setup script:**
   ```bash
   ssh root@your-vps
   curl -O https://raw.githubusercontent.com/you/repo/main/infra/scripts/setup-vps.sh
   chmod +x setup-vps.sh && ./setup-vps.sh
   ```

2. **Configure Traefik:**
   ```bash
   cd /opt/traefik
   # Copy traefik.yml and dynamic/ from repo
   docker compose up -d
   ```

3. **Set up environment:**
   ```bash
   cd /opt/my-saas/prod
   cp /path/to/.env.example .env
   cp /path/to/.secrets.example .secrets
   chmod 600 .secrets
   # Edit files with production values
   ```

4. **Deploy:**
   ```bash
   ./deploy.sh prod v1.0.0
   ```

### GitHub Secrets Required

| Secret | Description |
|--------|-------------|
| `DEV_HOST` | DEV VPS hostname |
| `DEV_USER` | SSH user for DEV |
| `DEV_SSH_KEY` | SSH private key for DEV |
| `PROD_HOST` | PROD VPS hostname |
| `PROD_USER` | SSH user for PROD |
| `PROD_SSH_KEY` | SSH private key for PROD |
| `DEV_API_URL` | https://api.dev.yourdomain.com |
| `PROD_API_URL` | https://api.yourdomain.com |

## Security Checklist

- [ ] TLS/HTTPS enabled (Traefik + Let's Encrypt)
- [ ] Rate limiting configured
- [ ] Security headers set
- [ ] Secrets in `.secrets` file (never in git)
- [ ] `.secrets` has 600 permissions
- [ ] JWT secrets are strong (64+ bytes)
- [ ] Production uses `migrate deploy` only
- [ ] Backups are automated

## Scripts Reference

| Script | Location | Description |
|--------|----------|-------------|
| `migrate-safe.sh` | `apps/api/scripts/` | Safe migration with backup |
| `backup-db.sh` | `apps/api/scripts/` | Create database backup |
| `restore-db.sh` | `apps/api/scripts/` | Restore from backup |
| `deploy.sh` | `infra/scripts/` | Deploy to VPS |
| `backup.sh` | `infra/scripts/` | Infra-level backup |
| `rotate-secret.sh` | `infra/scripts/` | Rotate secrets safely |
| `setup-vps.sh` | `infra/scripts/` | Initial VPS setup |

## License

Private - All rights reserved
