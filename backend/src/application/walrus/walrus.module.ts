import { Module } from '@nestjs/common';
import { WalrusService } from './walrus.service';
import { MongooseModule } from '@nestjs/mongoose';
import { SystemConfig, SystemConfigSchema } from 'src/domain';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SystemConfig.name, schema: SystemConfigSchema },
    ]),
  ],
  providers: [WalrusService],
  exports: [WalrusService],
})
export class WalrusModule {}
