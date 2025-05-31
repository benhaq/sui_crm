import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { Min } from 'class-validator';
import { Max } from 'class-validator';

export class PaginationQueryDto {
  @ApiProperty({ required: false, type: Number })
  @Type(() => Number)
  @Min(1)
  page = 1;

  @ApiProperty({ required: false, type: Number })
  @Type(() => Number)
  @Min(1)
  @Max(100)
  size = 10;
}

export class BaseQueryDto extends PaginationQueryDto {
  @ApiProperty({ required: false, nullable: true, type: String })
  search: string;

  @ApiProperty({ required: false, nullable: true, type: String })
  orderBy: string;

  @ApiProperty({ required: false, nullable: true, type: Boolean })
  @Transform(({ value }) => {
    return [true, 'enabled', 'true'].indexOf(value) > -1;
  })
  desc = false;
}
