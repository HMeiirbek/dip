import { IsString, IsUUID } from 'class-validator';

export class AddContactDto {
  @IsString()
  @IsUUID()
  contactUserId!: string;
}
