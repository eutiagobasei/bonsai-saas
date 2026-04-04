import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { TenantAwarePrismaService } from './tenant-aware-prisma.service';
import { TenantContext } from './tenant-context';

@Global()
@Module({
  providers: [
    PrismaService,
    TenantAwarePrismaService,
    {
      provide: TenantContext,
      useValue: TenantContext,
    },
  ],
  exports: [PrismaService, TenantAwarePrismaService, TenantContext],
})
export class DatabaseModule {}
