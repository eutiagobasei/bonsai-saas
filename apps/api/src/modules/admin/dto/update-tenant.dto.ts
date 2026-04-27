import { IsOptional, IsString, IsEnum, MinLength, MaxLength } from 'class-validator';
import { Plan, TenantStatus } from '@prisma/client';

export class UpdateTenantDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsEnum(Plan)
  plan?: Plan;

  @IsOptional()
  @IsEnum(TenantStatus)
  status?: TenantStatus;
}
