# Decision: Token Optimization for LLM Development

**Date**: 2026-04-25
**Status**: Implemented

## Context

Claude Code consumes tokens proportional to code context. CRUD pages and services had significant duplication, resulting in:
- 400-480 lines per CRUD page
- 120-150 lines per CRUD service
- Repeated icon SVGs across files
- Similar API client definitions

## Decision

Implement abstractions to reduce token consumption by 60-70%:

1. **Icons Library** - Centralized icon components
2. **API Factory** - Generic CRUD API client generator
3. **useCrudPage Hook** - Encapsulates all CRUD page state/logic
4. **BaseCrudService** - Abstract class for backend CRUD operations
5. **Bonsai-Wiki Integration** - Knowledge management in /wiki

## Consequences

### Positive
- ~75% reduction in frontend CRUD code
- ~70% reduction in backend service code
- Consistent patterns across codebase
- Faster feature development
- Self-documenting framework

### Negative
- Learning curve for abstractions
- Less flexibility for non-standard CRUD
- Custom logic requires hook overrides

## Metrics

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| CRUD page lines | 400-480 | 80-120 | 75% |
| Service lines | 120-150 | 25-40 | 70% |
| API client lines | 10-15 | 2-3 | 80% |
| Time for new feature | 4h+ | 30-40min | 85% |
