import { SetMetadata } from '@nestjs/common';
import type { Role } from '../users.js';

/** Metadata key under which `@Roles()` stores the roles allowed on a route. */
export const ROLES_KEY = 'roles';

/** Declares which roles may call a route. Read by RolesGuard. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
