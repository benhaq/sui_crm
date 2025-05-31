import { ApiProperty } from '@nestjs/swagger';

export class GetSwapHistories {
  @ApiProperty({ required: false })
  status?: number;

  @ApiProperty({ required: false })
  address?: string;

  @ApiProperty({ required: false })
  swapAforB?: boolean;

  @ApiProperty({ required: false })
  txDigest?: string;

  @ApiProperty({ required: true })
  requestor: string;

  @ApiProperty({ required: false, default: 1 })
  page?: number;

  @ApiProperty({ required: false, default: 10 })
  limit?: number;
}
