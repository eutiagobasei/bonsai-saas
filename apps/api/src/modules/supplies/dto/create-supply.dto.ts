import {
  IsString,
  IsOptional,
  IsNumber,
  MinLength,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSupplyDto {
  @ApiProperty({
    description: 'Supply name',
    example: 'Filé Mignon',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Category ID',
    example: 'clxx123...',
  })
  @IsString()
  categoryId: string;

  @ApiProperty({
    description: 'Unit of measurement',
    example: 'kg',
    maxLength: 20,
  })
  @IsString()
  @MaxLength(20)
  unit: string;

  @ApiPropertyOptional({
    description: 'Supply description',
    example: 'Filé mignon bovino de primeira',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: 'Minimum stock level for alerts',
    example: 5.0,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minStock?: number;
}
