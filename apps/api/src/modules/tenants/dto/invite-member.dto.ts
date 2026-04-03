import { IsEmail, IsEnum, IsOptional } from 'class-validator';
import { TenantRole } from '@prisma/client';

export class InviteMemberDto {
  @IsEmail()
  email: string;

  @IsEnum(TenantRole)
  @IsOptional()
  role?: TenantRole;
}
