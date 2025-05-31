import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { Max, Min } from 'class-validator';
export interface BaseResult<T> {
  success: boolean;
  message: string;
  data: T;
}

export class PaginationDto<T> {
  public total: number;
  public currentPage: number;
  public size: number;
  public pages: number;
  public hasNext: boolean;
  public hasPrevious: boolean;
  public items: T[];
  public constructor();

  public constructor(total: number, page: number, size: number);

  public constructor(items: T[], total: number, page: number, size: number);

  public constructor(...args: any[]) {
    if (args.length === 3) {
      this.total = Number(args[0]);
      this.currentPage = Number(args[1]);
      this.size = Number(args[2]);
      this.items = [];
      this.pages =
        Number(args[0]) === 0 ? 0 : Math.ceil((1.0 * this.total) / this.size);
    }
    if (args.length === 4) {
      this.total = args[1];
      this.currentPage = Number(args[2]);
      this.size = Number(args[3]);
      this.items = args[0];
      this.pages =
        Number(args[1]) === 0 ? 0 : Math.ceil((1.0 * this.total) / this.size);
    }
    this.hasNext = this.pages > this.currentPage;
    this.hasPrevious = this.currentPage > 1;
  }
}

export class BaseQueryParams {
  @ApiProperty()
  @Type(() => Number)
  @Min(1)
  page = 1;

  @ApiProperty()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  size = 10;

  orderBy: string;

  fields: string;

  @Transform(({ value }) => {
    return [true, 'enabled', 'true'].indexOf(value) > -1;
  })
  desc: boolean;

  search: string;
}
