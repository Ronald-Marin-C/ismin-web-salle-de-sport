import { Controller, Get, NotFoundException, Param, Patch, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthGuard, type JwtPayload } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { SearchQueryDto } from './dto/search-query.dto.js';
import { StudentDto } from './dto/student.dto.js';
import { UserNotFound, type Student } from './user.js';
import { UsersService } from './users.service.js';

/** Finding the students and validating their initiation. Every route requires the referent role. */
@Controller('users')
@UseGuards(AuthGuard, RolesGuard)
@Roles('referent')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
@ApiForbiddenResponse({ description: 'Requires the referent role' })
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /** Searches the students by name or email, with the state of their initiation. */
  @Get()
  @ApiOperation({ summary: 'Search the students by name or email, with their initiation' })
  @ApiOkResponse({ type: [StudentDto], description: 'At most 50, by last name then first name' })
  @ApiBadRequestResponse({ description: 'Search longer than 100 characters, or given twice' })
  search(@Query() query: SearchQueryDto): Promise<Student[]> {
    return this.users.searchStudents(query.search);
  }

  /**
   * Validates the initiation of a student, signed by the connected referent.
   *
   * @throws NotFoundException (404) when no account has this id.
   */
  @Patch(':id/initiation')
  @ApiOperation({ summary: 'Validate the initiation of a student; validating it again keeps the first validation' })
  @ApiParam({ name: 'id', description: 'Id of the student' })
  @ApiOkResponse({ type: StudentDto })
  @ApiNotFoundResponse({ description: 'No account has this id' })
  async validateInitiation(@CurrentUser() referent: JwtPayload, @Param('id') id: string): Promise<Student> {
    try {
      return await this.users.validateInitiation(id, referent.sub, new Date());
    } catch (error) {
      if (error instanceof UserNotFound) throw new NotFoundException(error.message);
      throw error;
    }
  }
}
