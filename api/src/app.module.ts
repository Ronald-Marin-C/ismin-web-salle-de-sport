import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { HealthController } from './health/health.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RegistrationsModule } from './registrations/registrations.module.js';
import { SlotsModule } from './slots/slots.module.js';

/** Root module: the database, authentication, the planning, the bookings and the health check. */
@Module({
  imports: [PrismaModule, AuthModule, SlotsModule, RegistrationsModule],
  controllers: [HealthController],
})
export class AppModule {}
