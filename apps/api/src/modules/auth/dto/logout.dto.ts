import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class LogoutDto {
  @ApiPropertyOptional({
    description: 'Specific refresh token to revoke. If omitted, all tokens are revoked.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  @IsOptional()
  refreshToken?: string;
}
