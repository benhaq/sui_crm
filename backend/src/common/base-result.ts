import { ApiProperty } from '@nestjs/swagger';

export class BaseResultDto<T> {
  @ApiProperty()
  data: T;

  @ApiProperty()
  success = true;

  @ApiProperty()
  errors?: Record<string, string[]>;

  constructor(data?: T, success?: boolean, errors?: Record<string, string[]>) {
    this.data = data;
    this.success = success;
    this.errors = errors;
  }
}
