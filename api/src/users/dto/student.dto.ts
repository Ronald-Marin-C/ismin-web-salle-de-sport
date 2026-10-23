import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Student } from '../user.js';

/**
 * A student, as the referents' routes return them. `Student` is an interface,
 * erased at compile time: Swagger needs a class to read at runtime.
 */
export class StudentDto implements Student {
  @ApiProperty({ example: '3f0c9a52-6d1e-4b7a-9c1d-2f8e4a6b0c13' })
  id!: string;

  @ApiProperty({ example: 'Bob' })
  firstName!: string;

  @ApiProperty({ example: 'Durand' })
  lastName!: string;

  @ApiProperty({ example: 'bob.durand@castelmont.fr' })
  email!: string;

  @ApiProperty({ description: 'Whether a referent validated the initiation; booking requires it', example: true })
  initiationValidated!: boolean;

  @ApiPropertyOptional({
    description: 'When a referent validated the initiation, ISO 8601 in UTC; absent until then',
    type: String,
    format: 'date-time',
    example: '2026-10-21T08:30:00.000Z',
  })
  initiationValidatedAt?: Date;
}
