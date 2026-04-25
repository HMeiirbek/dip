import { IsEnum } from 'class-validator';
import { PrivacyWriteMode } from '@prisma/client';

export class UpdatePrivacyDto {
  @IsEnum(PrivacyWriteMode)
  allowMessagesFrom!: PrivacyWriteMode;
}
