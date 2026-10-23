import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Matches } from 'class-validator';

/**
 * The slot named by the path, `/slots/:date/:hour/…`. Only the format is
 * checked here; whether the slot is on the planning is a booking rule.
 */
export class SlotParamsDto {
  @ApiProperty({ description: 'Day of the slot, Paris time, as YYYY-MM-DD', example: '2026-10-21' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @ApiProperty({ description: 'Hour of the slot, from 7 to 21; other hours answer 422', example: 18 })
  @Type(() => Number)
  @IsInt()
  hour!: number;
}
