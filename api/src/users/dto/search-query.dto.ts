import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, MaxLength } from 'class-validator';

/** The query of `GET /users`. */
export class SearchQueryDto {
  @ApiPropertyOptional({
    description: 'Part of the first name, the last name or the email; every student when absent',
    maxLength: 100,
    example: 'mart',
  })
  @IsOptional()
  // Also refuses anything but a string, such as a parameter given twice.
  @MaxLength(100)
  search?: string;
}
