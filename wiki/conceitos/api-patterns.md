# API Patterns

Conventions for API design and client implementation.

## API Endpoints

Standard REST endpoints for resources:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/{resource}` | List all (with query params) |
| GET | `/api/{resource}/:id` | Get by ID |
| POST | `/api/{resource}` | Create new |
| PATCH | `/api/{resource}/:id` | Partial update |
| DELETE | `/api/{resource}/:id` | Delete |

## Query Parameters

- `includeInactive=true` - Include inactive records
- `categoryId=xxx` - Filter by category (if applicable)
- `page=1&limit=20` - Pagination (when needed)

## Response Format

All responses use the entity directly (no wrapper):

```json
// GET /api/supplies
[
  { "id": "1", "name": "Item 1", ... },
  { "id": "2", "name": "Item 2", ... }
]

// GET /api/supplies/1
{ "id": "1", "name": "Item 1", ... }
```

## Error Responses

```json
{
  "statusCode": 400,
  "message": "Error description",
  "error": "Bad Request"
}
```

## API Client Factory

Use `createCrudApi` for standard CRUD resources:

```typescript
// Definition
export const supplyCategoryApi = createCrudApi<SupplyCategory>('/supply-categories');

// Custom endpoints can be added
export const supplyCategoryApi = {
  ...createCrudApi<SupplyCategory>('/supply-categories'),
  getStats: () => api.get('/supply-categories/stats'),
};
```

## Type Definitions

Keep types co-located with API clients in `apps/web/src/lib/api.ts`:

```typescript
export interface SupplyCategory {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  color?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSupplyCategoryData {
  name: string;
  description?: string;
  color?: string;
}
```
