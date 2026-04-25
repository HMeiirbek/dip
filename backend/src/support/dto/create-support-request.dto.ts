import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

export class CreateSupportRequestDto {
  @IsString()
  @Length(2, 120)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  topic!: string;

  @IsString()
  @Length(5, 5000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  text!: string;
}
