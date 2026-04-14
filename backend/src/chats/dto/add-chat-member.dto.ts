import { IsUUID } from 'class-validator';

export class AddChatMemberDto {
  @IsUUID()
  memberId!: string;
}
