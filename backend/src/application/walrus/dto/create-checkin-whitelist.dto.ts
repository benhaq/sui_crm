import { ApiProperty } from '@nestjs/swagger';

export class CreateCheckInWhitelistDto {
  @ApiProperty({ required: true })
  walletAddresses: string[];

  @ApiProperty({ required: true })
  signature: string;
}
