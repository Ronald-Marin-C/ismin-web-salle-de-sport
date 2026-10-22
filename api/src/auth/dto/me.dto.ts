import { ApiProperty } from '@nestjs/swagger';
import { ROLES, type Role } from '../../users/user.js';

/** The profile of the connected user, as `GET /auth/me` returns it. */
export class MeDto {
  @ApiProperty({ example: '3f0c9a52-6d1e-4b7a-9c1d-2f8e4a6b0c13' })
  id!: string;

  @ApiProperty({ example: 'alice.martin@castelmont.fr' })
  email!: string;

  @ApiProperty({ example: 'Alice' })
  firstName!: string;

  @ApiProperty({ example: 'Martin' })
  lastName!: string;

  @ApiProperty({ enum: ROLES, enumName: 'Role', example: 'student' })
  role!: Role;

  @ApiProperty({ description: 'Whether a referent validated the initiation; booking requires it', example: true })
  initiationValidated!: boolean;
}
