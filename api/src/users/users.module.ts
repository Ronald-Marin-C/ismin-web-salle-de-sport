import { Module } from '@nestjs/common';
import { UsersService } from './users.service.js';

/** The accounts, stored in the User table. */
@Module({
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
