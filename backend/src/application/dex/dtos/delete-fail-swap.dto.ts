import { ApiProperty } from '@nestjs/swagger';

export class DeleteFailSwapHistoriesDto {
  @ApiProperty({ required: true })
  deleteAllPool: boolean;

  @ApiProperty({ required: true })
  requestor: string;
}
