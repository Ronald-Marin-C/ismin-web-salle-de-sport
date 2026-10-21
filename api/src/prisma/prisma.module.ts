import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

/** Global module: PrismaService can be injected anywhere without importing it. */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
