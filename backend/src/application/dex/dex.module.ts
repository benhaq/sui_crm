import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DexService } from './dex.service';
// Assuming AppConfiguration is a type/interface, we don't need it here for injection
// import { AppConfiguration, InjectAppConfig } from 'src/config';
import { ConfigService } from '@nestjs/config'; // Import ConfigService
import { AppConfiguration } from 'src/config'; // Import the type for type hinting

@Global()
@Module({
  imports: [MongooseModule.forFeature([])],
  providers: [
    {
      provide: DexService,
      // Factory now receives ConfigService
      useFactory: async (configService: ConfigService) => {
        // Retrieve the specific app config part from the global ConfigService
        // Replace 'app' if your configuration is registered under a different key
        const appConfig = configService.get<AppConfiguration>('app');
        if (!appConfig) {
          throw new Error(
            'AppConfiguration not found in ConfigService. Ensure it is registered correctly.',
          );
        }
        const service = new DexService(appConfig); // Pass the retrieved config
        await service.initialize();
        return service;
      },
      inject: [ConfigService],
    },
  ],
  controllers: [],
  exports: [DexService],
})
export class DexModule {}
