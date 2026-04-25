import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

export class SendChatMessageDto {
  @IsString()
  @Length(1, 4000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  content!: string;
}
