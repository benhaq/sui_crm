import { ApiProperty } from '@nestjs/swagger';

export class SwapAllTokenDto {
  @ApiProperty({ required: true })
  requestor: string;

  @ApiProperty({ required: true })
  swapAforB: boolean;

  @ApiProperty({ required: true })
  slippage: number;

  @ApiProperty({ required: true })
  coinTypeA: string;

  @ApiProperty({ required: true })
  coinTypeB: string;
}
