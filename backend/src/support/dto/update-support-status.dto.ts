import { IsIn, IsString } from 'class-validator';

export class UpdateSupportStatusDto {
  @IsString()
  @IsIn(['open', 'in_progress', 'resolved', 'closed'])
  status!: string;
}
