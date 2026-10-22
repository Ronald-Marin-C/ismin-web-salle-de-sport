import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';

const secret = process.env.JWT_SECRET;
if (!secret) throw new Error('JWT_SECRET is not set: cp .env.example .env');

/**
 * Signs and verifies the JWTs with JWT_SECRET; a token is valid for one hour.
 *
 * `global: true` makes JwtService injectable everywhere, so `AuthGuard` works
 * in any module without importing anything.
 */
@Module({
  imports: [JwtModule.register({ global: true, secret, signOptions: { expiresIn: '1h' } }), UsersModule],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard],
  exports: [AuthGuard],
})
export class AuthModule {}
