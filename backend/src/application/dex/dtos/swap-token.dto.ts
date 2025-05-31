import { ApiProperty } from '@nestjs/swagger';

export class SwapTokenDto {
  @ApiProperty({ required: true })
  walletAddresses: string[];

  @ApiProperty({ required: true })
  configId: string;

  @ApiProperty({ required: true })
  requestor: string;
}
