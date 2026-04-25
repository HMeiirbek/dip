import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

export class ExportAccountQueryDto {
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === undefined) return undefined;
    if (typeof value === 'boolean') return value;
    return `${value}`.toLowerCase() === 'true';
  })
  includeMessages?: boolean;
}
