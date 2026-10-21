import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest, JwtPayload } from './auth.guard.js';

/** Parameter decorator: the user that AuthGuard attached to the request. */
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): JwtPayload | undefined => {
  return context.switchToHttp().getRequest<AuthenticatedRequest>().user;
});
