import { IsEmail, IsIn, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TenantRole } from '@prisma/client';

// Roles that can be assigned via invitation (OWNER cannot be invited)
const INVITABLE_ROLES = [TenantRole.ADMIN, TenantRole.MEMBER, TenantRole.VIEWER] as const;

export class InviteMemberDto {
  @ApiProperty({
    description: 'Email of the user to invite',
    example: 'newmember@example.com',
  })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({
    description: 'Role to assign to the new member (OWNER cannot be invited)',
    enum: INVITABLE_ROLES,
    default: TenantRole.MEMBER,
  })
  @IsIn(INVITABLE_ROLES, {
    message: 'Cannot invite users as OWNER. Allowed roles: ADMIN, MEMBER, VIEWER',
  })
  @IsOptional()
  role?: TenantRole;
}
