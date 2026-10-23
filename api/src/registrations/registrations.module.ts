import { Module } from '@nestjs/common';
import { RegistrationsController } from './registrations.controller.js';
import { RegistrationsService } from './registrations.service.js';

/** Booking the slots and their waiting lists. */
@Module({
  controllers: [RegistrationsController],
  providers: [RegistrationsService],
})
export class RegistrationsModule {}
