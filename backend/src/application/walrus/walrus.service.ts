import { Injectable } from '@nestjs/common';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { SystemConfigDocument, SystemConfig } from 'src/domain';
import { encryptBlob } from 'src/utils/private-walrus';
import { CreateCheckInWhitelistDto } from './dto';
import { getRandomRpcProvider } from 'src/utils/sui-blockchain';
import { executeTransactionWithRetry } from 'src/utils/sui-blockchain';

@Injectable()
export class WalrusService {
  constructor(
    @InjectModel(SystemConfig.name)
    private readonly systemConfigModel: Model<SystemConfigDocument>,
  ) {}
  async createCheckInWhitelist(dto: CreateCheckInWhitelistDto) {
    const { walletAddresses } = dto;
  }
}
