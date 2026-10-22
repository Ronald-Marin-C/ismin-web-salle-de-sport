import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Body of `POST /auth/register`. There is no `role` field: registration only
 * creates students, and the validation rejects any extra property.
 */
export class RegisterDto {
  @ApiProperty({ example: 'Chloé', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  firstName!: string;

  @ApiProperty({ example: 'Petit', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  lastName!: string;

  @ApiProperty({ description: 'Must belong to the school domain', example: 'chloe.petit@castelmont.fr' })
  @IsEmail()
  email!: string;

  // A floor of 8 characters and no composition rules, as OWASP recommends;
  // the ceiling keeps scrypt from hashing an arbitrarily long input.
  @ApiProperty({ example: 'correct-horse', minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
