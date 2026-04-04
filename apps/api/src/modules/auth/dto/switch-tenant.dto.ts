import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SwitchTenantDto {
  @ApiProperty({
    description: 'ID of the tenant to switch to',
    example: 'clx1234567890abcdef',
  })
  @IsString()
  tenantId: string;
}
