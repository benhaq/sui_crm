import { Module } from '@nestjs/common';
import { WalrusModule } from './walrus/walrus.module';

@Module({
  imports: [WalrusModule],
})
export class ApplicationModule {}
