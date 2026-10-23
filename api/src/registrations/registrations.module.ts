import { Module } from '@nestjs/common';
import { SlotsModule } from '../slots/slots.module.js';
import { RegistrationsController } from './registrations.controller.js';
import { RegistrationsService } from './registrations.service.js';

/** Booking the slots and their waiting lists. */
@Module({
  imports: [SlotsModule],
  controllers: [RegistrationsController],
  providers: [RegistrationsService],
})
export class RegistrationsModule {}
