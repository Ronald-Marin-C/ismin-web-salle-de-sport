import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserNotFound } from '../users/user.js';
import { EmailAlreadyUsed, EmailNotFromSchool, InvalidCredentials } from './auth.errors.js';
import { AuthGuard, type JwtPayload } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { CurrentUser } from './current-user.decorator.js';
import { AccessTokenDto } from './dto/access-token.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { MeDto } from './dto/me.dto.js';
import { RegisterDto } from './dto/register.dto.js';

/**
 * Registration, login and profile of the connected user. Translates the
 * domain errors into HTTP statuses.
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Create a student account with the school email' })
  @ApiCreatedResponse({ type: AccessTokenDto, description: 'Account created; a token valid for one hour' })
  @ApiBadRequestResponse({ description: 'Invalid body, or an email outside the school domain' })
  @ApiConflictResponse({ description: 'An account already uses this email' })
  async register(@Body() dto: RegisterDto): Promise<AccessTokenDto> {
    try {
      return { access_token: await this.auth.register(dto) };
    } catch (error) {
      if (error instanceof EmailNotFromSchool) throw new BadRequestException(error.message);
      if (error instanceof EmailAlreadyUsed) throw new ConflictException(error.message);
      throw error;
    }
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Log in with the school email' })
  @ApiOkResponse({ type: AccessTokenDto, description: 'A token valid for one hour' })
  @ApiBadRequestResponse({ description: 'Invalid body' })
  @ApiUnauthorizedResponse({ description: 'Wrong email or password' })
  async login(@Body() dto: LoginDto): Promise<AccessTokenDto> {
    try {
      return { access_token: await this.auth.login(dto.email, dto.password) };
    } catch (error) {
      if (error instanceof InvalidCredentials) throw new UnauthorizedException(error.message);
      throw error;
    }
  }

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Profile of the connected user, initiation status included' })
  @ApiOkResponse({ type: MeDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid token, or the account no longer exists' })
  async me(@CurrentUser() user: JwtPayload): Promise<MeDto> {
    try {
      return await this.auth.me(user.sub);
    } catch (error) {
      if (error instanceof UserNotFound) throw new UnauthorizedException(error.message);
      throw error;
    }
  }
}
