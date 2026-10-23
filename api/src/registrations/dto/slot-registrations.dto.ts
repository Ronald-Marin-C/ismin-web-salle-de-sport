import { ApiProperty } from '@nestjs/swagger';
import type { Person, SlotRegistrations } from '../registration.js';

/** A registered user, as the referents see them. */
export class PersonDto implements Person {
  @ApiProperty({ example: 'Alice' })
  firstName!: string;

  @ApiProperty({ example: 'Martin' })
  lastName!: string;

  @ApiProperty({ example: 'alice.martin@castelmont.fr' })
  email!: string;
}

/** A user in the waiting list of a slot. */
export class WaitingPersonDto extends PersonDto {
  @ApiProperty({ description: 'Place in the waiting list, 1 for the first', minimum: 1, example: 1 })
  position!: number;
}

/**
 * Who registered to a slot, as `GET /slots/:date/:hour/registrations` returns it.
 * The domain types are interfaces, erased at compile time: Swagger needs classes to read at runtime.
 */
export class SlotRegistrationsDto implements SlotRegistrations {
  @ApiProperty({ type: [PersonDto], description: 'The holders of a place, in order of arrival' })
  confirmed!: PersonDto[];

  @ApiProperty({ type: [WaitingPersonDto], description: 'The waiting list, first in line first' })
  waiting!: WaitingPersonDto[];
}
