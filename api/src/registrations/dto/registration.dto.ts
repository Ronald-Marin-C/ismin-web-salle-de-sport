import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { REGISTRATION_STATUSES, type Registration, type RegistrationStatus } from '../registration.js';

/**
 * A registration, as its owner sees it. `Registration` is an interface,
 * erased at compile time: Swagger needs a class to read at runtime.
 */
export class RegistrationDto implements Registration {
  @ApiProperty({ description: 'Id of the registration', example: '8b1d4c2e-5f3a-4e6b-9a7c-1d2e3f4a5b6c' })
  id!: string;

  @ApiProperty({ description: 'Day of the slot, Paris time', example: '2026-10-21' })
  date!: string;

  @ApiProperty({ description: 'The slot runs from hour:00 to hour+1:00', minimum: 7, maximum: 21, example: 18 })
  hour!: number;

  @ApiProperty({
    enum: REGISTRATION_STATUSES,
    enumName: 'RegistrationStatus',
    description: 'confirmed: a place in the slot; waiting: a place in its waiting list',
  })
  status!: RegistrationStatus;

  @ApiPropertyOptional({
    description: 'Place in the waiting list, 1 for the first; only when status is waiting',
    minimum: 1,
    example: 2,
  })
  position?: number;

  @ApiProperty({ description: 'Start of the slot, ISO 8601 in UTC', example: '2026-10-21T16:00:00.000Z' })
  startsAt!: string;
}
