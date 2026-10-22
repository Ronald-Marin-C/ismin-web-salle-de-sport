import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

/** Body of `POST /auth/login`. The email is matched whatever its case. */
export class LoginDto {
  @ApiProperty({ example: 'alice.martin@castelmont.fr' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'salle-de-sport' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}
