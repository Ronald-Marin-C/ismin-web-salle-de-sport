import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** The query of `GET /users`. */
export class SearchQueryDto {
  @ApiPropertyOptional({
    description: 'Part of the first name, the last name or the email; every student when absent',
    maxLength: 100,
    example: 'mart',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
