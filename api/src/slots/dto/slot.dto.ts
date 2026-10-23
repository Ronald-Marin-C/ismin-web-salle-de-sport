import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { REGISTRATION_STATUSES, type RegistrationStatus, type SlotView } from '../slot.js';

/**
 * A slot, as `GET /slots` returns it. `SlotView` is an interface, erased at
 * compile time: Swagger needs a class to read at runtime.
 */
export class SlotDto implements SlotView {
  @ApiProperty({ description: 'Day of the slot, Paris time', example: '2026-10-21' })
  date!: string;

  @ApiProperty({ description: 'The slot runs from hour:00 to hour+1:00', minimum: 7, maximum: 21, example: 18 })
  hour!: number;

  @ApiProperty({ description: 'Start of the slot, ISO 8601 in UTC', example: '2026-10-21T16:00:00.000Z' })
  startsAt!: string;

  @ApiProperty({ description: 'Places left out of 12', minimum: 0, maximum: 12, example: 3 })
  remaining!: number;

  @ApiProperty({ description: 'Number of people in the waiting list', minimum: 0, example: 0 })
  waitingCount!: number;

  @ApiProperty({ description: 'Whether the slot has started', example: false })
  isPast!: boolean;

  @ApiPropertyOptional({
    enum: REGISTRATION_STATUSES,
    enumName: 'RegistrationStatus',
    description: "The connected user's registration; absent when they are not registered",
  })
  myStatus?: RegistrationStatus;

  @ApiPropertyOptional({
    description: 'Place in the waiting list, 1 for the first; only when myStatus is waiting',
    minimum: 1,
    example: 2,
  })
  myPosition?: number;

  @ApiPropertyOptional({
    description: "Id of the connected user's registration",
    example: '8b1d4c2e-5f3a-4e6b-9a7c-1d2e3f4a5b6c',
  })
  myRegistrationId?: string;
}
