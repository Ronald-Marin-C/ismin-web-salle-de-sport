import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Body of `POST /auth/login`. The email is matched whatever its case. */
export class LoginDto {
  @ApiProperty({ example: 'alice.martin@castelmont.fr' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'salle-de-sport', maxLength: 128 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;
}
