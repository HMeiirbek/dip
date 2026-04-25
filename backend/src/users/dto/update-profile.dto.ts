import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length, Matches } from 'class-validator';

const USERNAME_REGEX = /^[A-Za-z0-9_]{3,20}$/;
const AVATAR_URL_REGEX = /^https?:\/\/.+\.(jpg|jpeg|png)(\?.*)?$/i;

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(1, 80)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(USERNAME_REGEX, {
    message: 'username must be 3-20 chars and contain only latin letters, digits, "_"',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  username?: string;

  @IsOptional()
  @IsString()
  @Matches(AVATAR_URL_REGEX, {
    message: 'avatarUrl must be a valid http(s) URL ending with jpg/jpeg/png',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  avatarUrl?: string;
}
