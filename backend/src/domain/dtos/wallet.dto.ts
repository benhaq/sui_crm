import { ApiProperty } from '@nestjs/swagger';

export class WalletDto {
  @ApiProperty({
    description: 'The address of the wallet',
    example: '0x1234567890123456789012345678901234567890',
  })
  address: string;

  @ApiProperty({
    description: 'The account id of the wallet',
    example: '123456789012345678901234',
  })
  accountId: string;
}
