import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';

/**
 * Interceptor that extracts tenant context from the JWT and attaches it to the request.
 * This runs after authentication and makes tenant info available throughout the request lifecycle.
 */
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    // If user is authenticated and has a tenantId, set it on the request
    if (request.user?.tenantId) {
      request.tenantId = request.user.tenantId;
      request.tenantSchema = `tenant_${request.user.tenantId}`;
    }

    return next.handle();
  }
}
