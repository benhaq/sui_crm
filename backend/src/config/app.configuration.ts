import { Inject } from '@nestjs/common';
import { ConfigType, registerAs } from '@nestjs/config';

export const appConfiguration = registerAs('app', () => {
  return {
    baseUrl: process.env.URL || '',
    host: process.env.HOST || 'localhost',
    port: process.env.PORT || 6003,
    auth: {
      x_api_key: process.env.X_API_KEY || '',
    },
    mongodb: {
      connection: process.env.MONGODB_URI || 'mongodb://localhost:27017',
      dbName: process.env.MONGODB_DBNAME || 'sui_mm',
    },
    suiNetwork: {
      rpc: process.env.SUI_NETWORK_RPC || 'https://fullnode.mainnet.sui.io',
      faucet:
        process.env.SUI_NETWORK_FAUCET || 'https://faucet.testnet.sui.io/gas',
      privateKey: process.env.MARKET_MAKER_SOURCE_WALLET_PK || '',
      wallets: JSON.parse(process.env.SUI_NETWORK_WALLETS) || {},
      gasBudget: process.env.SUI_NETWORK_GAS_BUDGET || '0.003',
      connectionPool: process.env.SUI_NETWORK_CONNECTION_POOL || '',
      proxies: process.env.SUI_PROXIES || '',
      maxSwapAttempts: process.env.SUI_NETWORK_MAX_SWAP_ATTEMPTS || 100,
      policyObject: process.env.SUI_NETWORK_POLICY_OBJECT || '',
      packageId: process.env.SUI_NETWORK_PACKAGE_ID || '',
    },
    aesSecretKey: process.env.AES_SECRET_KEY,
  };
});

export type AppConfiguration = ConfigType<typeof appConfiguration>;
export const InjectAppConfig = () => Inject(appConfiguration.KEY);
