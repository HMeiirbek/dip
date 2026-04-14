import { IsString, IsUUID } from 'class-validator';

export class MarkChatReadDto {
  @IsString()
  @IsUUID()
  messageId!: string;
}
