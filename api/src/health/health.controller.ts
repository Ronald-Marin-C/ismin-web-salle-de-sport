import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';

/**
 * Liveness check. Answers 200 as soon as the application runs, without a
 * token: the compose healthcheck waits for it before starting the front.
 */
@Controller('health')
export class HealthController {
  /** @returns `ok`, and the number of seconds since the process started. */
  @Get()
  @ApiOperation({ summary: 'Check that the API is running' })
  @ApiOkResponse({
    description: 'The API is running',
    schema: { example: { status: 'ok', uptime: 12.3 } },
  })
  check(): { status: string; uptime: number } {
    return { status: 'ok', uptime: process.uptime() };
  }
}
