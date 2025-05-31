import { Controller, Post, UseGuards, Body } from '@nestjs/common';
import {
  ApiHeader,
  ApiResponse,
  ApiTags,
  ApiOperation,
  ApiSecurity,
} from '@nestjs/swagger';
import { ApiKeyGuard } from 'src/auth/api-key.guard';
import { WalletService } from './wallet.service';
import { MultiSendRequestDto, MultiSendResponseDto } from './models';

@Controller('wallets')
@ApiTags('Wallets')
@UseGuards(ApiKeyGuard)
@ApiSecurity('x-api-key')
@ApiHeader({
  name: 'x-api-key',
  description: 'API key for authentication',
  required: true,
})
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new wallet' })
  @ApiResponse({
    status: 200,
    description: 'Wallet created successfully',
  })
  createWallet() {
    return this.walletService.create(5);
  }

  @Post('multi-send')
  @ApiOperation({
    summary: 'Send multiple transactions in a single transaction block',
  })
  @ApiResponse({
    status: 200,
    description: 'Multi-send transaction executed successfully',
    type: MultiSendResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request payload',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async multiSend(
    @Body() payload: MultiSendRequestDto,
  ): Promise<MultiSendResponseDto> {
    return this.walletService.multiSend(payload);
  }
}
