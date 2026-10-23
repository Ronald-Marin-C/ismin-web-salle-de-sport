import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { AuthGuard, type JwtPayload } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { SlotDto } from './dto/slot.dto.js';
import type { SlotView } from './slot.js';
import { SlotsService } from './slots.service.js';

/** The planning of the gym. */
@Controller('slots')
export class SlotsController {
  constructor(private readonly slots: SlotsService) {}

  /** Lists the slots of today and the next six days, with the connected user's registrations. */
  @Get()
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Slots of the next seven days: places left, waiting list and my registration' })
  @ApiOkResponse({ type: [SlotDto], description: '15 slots a day, from 7:00 to 22:00, by date then hour' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
  list(@CurrentUser() user: JwtPayload): Promise<SlotView[]> {
    return this.slots.listForUser(user.sub, new Date());
  }
}
