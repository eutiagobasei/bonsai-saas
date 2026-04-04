import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TenantRole } from '@prisma/client';

export class UpdateMemberRoleDto {
  @ApiProperty({
    description: 'New role for the member (cannot be OWNER)',
    enum: [TenantRole.ADMIN, TenantRole.MEMBER, TenantRole.VIEWER],
  })
  @IsEnum(TenantRole)
  role: TenantRole;
}
