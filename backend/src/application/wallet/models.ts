import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumberString,
  IsArray,
  ValidateNested,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateWalletResultDto {
  @ApiProperty({
    description: 'The wallet address',
    example: '0x123...',
  })
  address: string;

  @ApiProperty({
    description: 'The wallet private key',
    example: '0xabc...',
  })
  privateKey: string;

  @ApiProperty({
    description: 'The wallet mnemonic',
    example: 'word1 word2 word3...',
  })
  mnemonic: string;
}

export class MultiSendRecipientDto {
  @ApiProperty({
    description: 'The recipient wallet address',
    example: '0x123...',
  })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({
    description: 'The amount to send in base units (e.g., SUI instead of MIST)',
    example: '1.5',
  })
  @IsNumberString()
  @IsNotEmpty()
  amount: string;
}

export class MultiSendRequestDto {
  @ApiProperty({
    description: 'The coin type to send',
    example: '0x2::sui::SUI',
  })
  @IsString()
  @IsNotEmpty()
  coinType: string;

  @ApiProperty({
    description: 'List of recipients and amounts',
    type: [MultiSendRecipientDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MultiSendRecipientDto)
  recipients: MultiSendRecipientDto[];
}

export class MultiSendResponseDto {
  @ApiProperty({
    description: 'The transaction hash',
    example: '0xabc...',
  })
  transactionHash: string;
}
