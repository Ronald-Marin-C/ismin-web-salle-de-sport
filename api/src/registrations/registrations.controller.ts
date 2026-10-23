import {
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { AuthGuard, type JwtPayload } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { RegistrationDto } from './dto/registration.dto.js';
import { SlotParamsDto } from './dto/slot-params.dto.js';
import {
  AlreadyRegistered,
  DailyLimitReached,
  InitiationRequired,
  SlotNotBookable,
  type Registration,
} from './registration.js';
import { RegistrationsService } from './registrations.service.js';

/**
 * Booking the slots, and the list of one's own registrations. Translates the
 * domain errors into HTTP statuses. No common prefix: the routes are spelled out in full.
 */
@Controller()
export class RegistrationsController {
  constructor(private readonly registrations: RegistrationsService) {}

  /**
   * Books a slot for the connected user, or puts them on its waiting list when it is full.
   *
   * @throws ForbiddenException (403) when no referent has validated their initiation.
   * @throws ConflictException (409) when they already hold this slot, waiting list included.
   * @throws UnprocessableEntityException (422) when the slot cannot be booked, or when they
   * already hold two slots that day.
   */
  @Post('slots/:date/:hour/registrations')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Book a slot, or join its waiting list when it is full' })
  @ApiCreatedResponse({
    type: RegistrationDto,
    description: 'confirmed while places are left, then waiting with a position',
  })
  @ApiBadRequestResponse({ description: 'Malformed date or hour' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
  @ApiForbiddenResponse({ description: 'No referent has validated the initiation yet' })
  @ApiConflictResponse({ description: 'Already registered in this slot, waiting list included' })
  @ApiUnprocessableEntityResponse({
    description: 'Slot started, or outside the seven days or the opening hours; or two slots already held that day',
  })
  async register(@CurrentUser() user: JwtPayload, @Param() slot: SlotParamsDto): Promise<Registration> {
    try {
      return await this.registrations.register(user.sub, slot.date, slot.hour, new Date());
    } catch (error) {
      if (error instanceof InitiationRequired) throw new ForbiddenException(error.message);
      if (error instanceof AlreadyRegistered) throw new ConflictException(error.message);
      if (error instanceof SlotNotBookable || error instanceof DailyLimitReached) {
        throw new UnprocessableEntityException(error.message);
      }
      throw error;
    }
  }

  /** Lists the connected user's registrations whose slot is not over, by date then hour. */
  @Get('registrations/me')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'My registrations in the slots not over yet, with my place in the waiting lists' })
  @ApiOkResponse({ type: [RegistrationDto], description: 'By date then hour' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
  findMine(@CurrentUser() user: JwtPayload): Promise<Registration[]> {
    return this.registrations.findMine(user.sub, new Date());
  }
}
