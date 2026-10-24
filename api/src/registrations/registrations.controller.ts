import {
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
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
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { AuthGuard, type JwtPayload } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { RegistrationDto } from './dto/registration.dto.js';
import { SlotParamsDto } from './dto/slot-params.dto.js';
import { SlotRegistrationsDto } from './dto/slot-registrations.dto.js';
import {
  AlreadyRegistered,
  CancellationTooLate,
  DailyLimitReached,
  InitiationRequired,
  NotYourRegistration,
  RegistrationNotFound,
  SlotNotBookable,
  SlotNotFound,
  type Registration,
  type SlotRegistrations,
} from './registration.js';
import { RegistrationsService } from './registrations.service.js';

/**
 * Booking and cancelling the slots, the list of one's own registrations and, for the
 * referents, who registered to a slot. Translates the domain errors into HTTP statuses.
 * No common prefix: the routes are spelled out in full.
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

  /**
   * Lists who registered to a slot: the holders of a place, then the waiting list.
   *
   * @throws NotFoundException (404) for an hour outside the opening hours, or a day that does not exist.
   */
  @Get('slots/:date/:hour/registrations')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('referent')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Who registered to a slot: the places, then the waiting list' })
  @ApiOkResponse({ type: SlotRegistrationsDto, description: 'Both lists in order of arrival' })
  @ApiBadRequestResponse({ description: 'Malformed date or hour' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
  @ApiForbiddenResponse({ description: 'Requires the referent role' })
  @ApiNotFoundResponse({ description: 'Hour outside the opening hours, or a day that does not exist' })
  async listForSlot(@Param() slot: SlotParamsDto): Promise<SlotRegistrations> {
    try {
      return await this.registrations.listForSlot(slot.date, slot.hour);
    } catch (error) {
      if (error instanceof SlotNotFound) throw new NotFoundException(error.message);
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

  /**
   * Cancels one of the connected user's registrations; a place it held goes to the first in
   * the waiting list.
   *
   * @throws NotFoundException (404) when no registration has this id.
   * @throws ForbiddenException (403) when the registration belongs to another user.
   * @throws UnprocessableEntityException (422) less than an hour before the slot.
   */
  @Delete('registrations/:id')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel my registration; a place it held goes to the first in the waiting list' })
  @ApiParam({ name: 'id', description: 'Id of the registration' })
  @ApiNoContentResponse({ description: 'Cancelled' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
  @ApiForbiddenResponse({ description: 'The registration belongs to another user' })
  @ApiNotFoundResponse({ description: 'No registration has this id' })
  @ApiUnprocessableEntityResponse({ description: 'Less than an hour before the slot' })
  async cancel(@CurrentUser() user: JwtPayload, @Param('id') id: string): Promise<void> {
    try {
      await this.registrations.cancel(user.sub, id, new Date());
    } catch (error) {
      if (error instanceof RegistrationNotFound) throw new NotFoundException(error.message);
      if (error instanceof NotYourRegistration) throw new ForbiddenException(error.message);
      if (error instanceof CancellationTooLate) throw new UnprocessableEntityException(error.message);
      throw error;
    }
  }
}
