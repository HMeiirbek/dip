import { IsString, IsUUID } from 'class-validator';

export class AddToBlacklistDto {
  @IsString()
  @IsUUID()
  blockedUserId!: string;
}
