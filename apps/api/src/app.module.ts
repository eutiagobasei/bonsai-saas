import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { DatabaseModule } from './common/database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { HealthModule } from './modules/health/health.module';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { TenantInterceptor } from './common/interceptors/tenant.interceptor';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // Database
    DatabaseModule,

    // Feature modules
    HealthModule,
    AuthModule,
    UsersModule,
    TenantsModule,
  ],
  providers: [
    // Global JWT Auth Guard (can be bypassed with @Public() decorator)
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Global Tenant Interceptor (extracts tenant from JWT)
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantInterceptor,
    },
  ],
})
export class AppModule {}
