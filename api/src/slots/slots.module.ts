import { Module } from '@nestjs/common';
import { SlotsController } from './slots.controller.js';
import { SlotsService } from './slots.service.js';

/** The planning, computed from the registrations. */
@Module({
  controllers: [SlotsController],
  providers: [SlotsService],
})
export class SlotsModule {}
