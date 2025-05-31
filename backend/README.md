# Sui MM Node with Aftermath SDK Integration

This project implements a market maker node for Sui that can execute swaps with optimal routing using the Aftermath SDK.

## Recent Updates

### Migrated from Cetus SDK to Aftermath SDK

The swap implementation has been updated to use the Aftermath SDK instead of Cetus SDK for improved route selection and better swap execution.

Key changes:

- Added `aftermath-ts-sdk` dependency
- Updated DexService to use Aftermath Router for finding optimal swap routes
- Maintained the same API interface for backward compatibility
- Improved error handling and logging

## Setup

### Environment Variables

To run the project, you need to set the following environment variables in a `.env` file:

```
SUI_NETWORK_RPC=https://fullnode.mainnet.sui.io
SUI_NETWORK_GAS_BUDGET=0.003
SUI_NETWORK_MAX_SWAP_ATTEMPTS=100
SUI_NETWORK_PRIVATE_KEY=your_private_key_here
SUI_NETWORK_WALLETS={}
SUI_NETWORK_CONNECTION_POOL=["https://fullnode.mainnet.sui.io"]
MONGODB_URI=mongodb://localhost:27017
MONGODB_DBNAME=sui_mm
X_API_KEY=your_api_key_here
```

### Installation

```bash
npm install
```

### Running the Application

```bash
npm run start
```

For development:

```bash
npm run start:dev
```

## Using the Aftermath SDK for Swaps

The implementation now uses Aftermath SDK to find the optimal swap routes between tokens. This provides better liquidity and price execution through:

1. Aggregating multiple DEXs and liquidity sources
2. Path optimization for better price execution
3. Auto-routing through multiple hops if needed

## Example Usage

To perform a swap using the API:

```bash
curl -X POST http://localhost:6003/api/dex/swap \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: your_api_key_here" \
  -d '{
    "walletAddresses": ["wallet_address_1", "wallet_address_2"],
    "configId": "your_config_id",
    "requestor": "requestor_address"
  }'
```

To swap all tokens of a specific type:

```bash
curl -X POST http://localhost:6003/api/dex/swap-all \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: your_api_key_here" \
  -d '{
    "requestor": "requestor_address",
    "poolAddress": "pool_address",
    "swapAforB": true,
    "slippage": 0.5,
    "coinTypeA": "0x2::sui::SUI",
    "coinTypeB": "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN"
  }'
```

## MM Configuration

The MM Config must include:

- `tokenAType` and `tokenBType`: Coin type ID strings
- `decimalsA` and `decimalsB`: Decimals for each token
- `slippage`: Slippage tolerance percentage
- Other standard configuration values (poolAddress, lowerBound, upperBound, etc.)
