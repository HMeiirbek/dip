import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class DeleteAccountDto {
  @IsOptional()
  @IsString()
  @Length(8, 128)
  password?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/, { message: 'confirmationCode must be a 6-digit code' })
  confirmationCode?: string;
}
