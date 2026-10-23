import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { HealthController } from './health/health.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { SlotsModule } from './slots/slots.module.js';

/** Root module: the database, authentication, the planning and the health check. */
@Module({
  imports: [PrismaModule, AuthModule, SlotsModule],
  controllers: [HealthController],
})
export class AppModule {}
