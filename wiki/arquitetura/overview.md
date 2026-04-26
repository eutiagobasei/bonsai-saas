# System Architecture

## Overview

My-SaaS is a multi-tenant SaaS framework using:
- **Backend**: NestJS with Prisma ORM
- **Frontend**: Next.js 14 (App Router)
- **Database**: PostgreSQL with Row Level Security
- **Cache**: Redis

## Multi-Tenancy

Each request includes tenant context:
1. JWT contains `tenantId`
2. Guards extract and validate tenant
3. Services receive `tenantId` as first parameter
4. Prisma queries filter by `tenantId`

## Authentication Flow

1. User logs in -> receives JWT (access token in memory, refresh in HttpOnly cookie)
2. Access token expires -> automatic refresh via interceptor
3. Refresh fails -> redirect to login

## Module Structure

```
apps/api/src/modules/[resource]/
├── [resource].module.ts      # NestJS module definition
├── [resource].controller.ts  # HTTP endpoints
├── [resource].service.ts     # Business logic
└── dto/                      # Validation DTOs
```

## Data Flow

```
Frontend (React)
    -> API Client (axios)
    -> Backend Controller
    -> Service (business logic)
    -> Prisma (database)
    -> PostgreSQL
```

## Key Services

| Service | Purpose |
|---------|---------|
| AuthService | Authentication, token management |
| TenantsService | Tenant management, members |
| UsersService | User profiles |
| BaseCrudService | Abstract CRUD operations |
