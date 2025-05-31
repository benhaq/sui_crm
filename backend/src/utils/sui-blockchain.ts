import * as bignum from 'bn.js';
import { RetryConfig, withRetry } from 'src/utils/retry.utils';
import { TransactionBlock, Transactions } from '@mysten/sui.js/transactions';
import {
  CoinMetadata,
  CoinStruct,
  DryRunTransactionBlockResponse,
  SuiClient,
  SuiEventFilter,
  SuiTransactionBlockResponse,
  SuiTransactionBlockResponseOptions,
  ExecuteTransactionRequestType,
} from '@mysten/sui.js/client';
import { Signer } from '@mysten/sui.js/cryptography';
import { Logger } from '@nestjs/common';
import { Coin } from 'aftermath-ts-sdk';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import random from 'lodash/random';
import { SUI_DECIMALS, SUI_TYPE_ARG } from '@mysten/sui.js/utils';
import axios, { AxiosInstance, AxiosRequestConfig, Method } from 'axios';
import axiosRetry from 'axios-retry';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { Response } from 'node-fetch'; // Use node-fetch Response for compatibility

// --- Define logger at top level ---
const logger = new Logger('SuiBlockchainUtils'); // Define logger here

// --- Define variables - will be initialized later ---
export let SUI_NETWORK_CONNECTION_POOL: string[] = [];
export let PROXIES: string[] = [];
export let rpcProviderPools: SuiClient[] = [];
export let suiClient: SuiClient;
export let SUI_NETWORK_RPC: string;
export let DEFAULT_SIGNER_HEX: string;

// --- Constants and Types (Define before use) ---
export const SUI_API_RETRY_CONFIG: Partial<RetryConfig> = {
  maxRetries: 5,
  initialDelayMs: 1000,
  maxDelayMs: 15000,
  backoffMultiplier: 1.5,
  jitterFactor: 0.1,
};

export type CoinObject = {
  objectId: string;
  type: string;
  symbol: string;
  balance: bigint;
  lockedUntilEpoch: number | null | undefined;
  previousTransaction: string;
  object: CoinStruct; // raw data
};

export interface SuiWallet {
  address: string;
  privateKeyHex: string;
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

// --- Helper Functions ---
const parseEnvList = (
  envVar: string | undefined,
  defaultValue: string[] = [],
): string[] => {
  if (!envVar) {
    return defaultValue;
  }
  return JSON.parse(envVar);
};

let proxyIndex = 0; // Define proxyIndex before getNextProxyUrl
function getNextProxyUrl(): string | undefined {
  if (PROXIES.length === 0) {
    return undefined;
  }
  const proxyUrl = PROXIES[proxyIndex % PROXIES.length];
  proxyIndex++;
  return proxyUrl;
}

const createAxiosInstanceWithProxyAndRetry = (
  proxyUrl?: string,
): AxiosInstance => {
  let agent: HttpsProxyAgent<string> | undefined;
  let axiosConfig: AxiosRequestConfig = {};

  if (proxyUrl) {
    // Mask credentials for logging
    const urlParts = proxyUrl.match(
      /^(http?:\/\/)(?:[^:@\/]+:[^:@\/]+@)?(.+)$/,
    );
    const maskedUrl = urlParts
      ? `${urlParts[1]}***:***@${urlParts[2]}`
      : 'proxy (format error?)';
    logger.log(`Configuring Axios with proxy: ${maskedUrl}`);
    try {
      agent = new HttpsProxyAgent(proxyUrl); // Use the correct format from proxy.txt
      axiosConfig = {
        httpsAgent: agent,
        proxy: false, // Disable system proxy settings
      };
    } catch (e) {
      logger.error(
        `Failed to create HttpsProxyAgent for ${maskedUrl}: ${e.message}`,
      );
    }
  }

  const instance = axios.create(axiosConfig);

  axiosRetry(instance, {
    retries: 3,
    retryDelay: (retryCount) => {
      logger.warn(`Axios request failed, retrying (${retryCount})...`);
      return retryCount * 1000;
    },
    retryCondition: (error) => {
      const shouldRetry =
        axiosRetry.isNetworkOrIdempotentRequestError(error) ||
        (error.response &&
          error.response.status >= 400 &&
          error.response.status < 600);
      if (shouldRetry) {
        logger.warn(
          `Retry condition met for status ${error.response?.status}: ${error.message}`,
        );
      }
      return shouldRetry;
    },
    shouldResetTimeout: true,
  });

  return instance;
};

const customFetch = async (
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> => {
  const proxyUrl = getNextProxyUrl();
  const axiosInstance = createAxiosInstanceWithProxyAndRetry(proxyUrl);

  const url = input.toString();
  const method = (init?.method?.toUpperCase() || 'GET') as Method;
  const headers = init?.headers as Record<string, string> | undefined;
  let data = init?.body;

  // Simple body handling (adjust if more complex bodies are needed)
  if (data && typeof data !== 'string') {
    // If body is not string, assume it's JSON stringifiable for RPC
    try {
      data = JSON.stringify(data);
    } catch (e) {
      logger.error('Failed to stringify fetch body for Axios');
      // Handle error appropriately, maybe throw?
    }
  }

  try {
    const response = await axiosInstance.request({
      url,
      method,
      headers,
      data,
      responseType: 'arraybuffer', // Get response as buffer to construct Response
    });

    // Create a fetch-compatible Response object
    return new Response(response.data, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers as Record<string, string>,
    });
  } catch (error: any) {
    logger.error(`Axios request failed for URL ${url}: ${error.message}`);
    // Simulate a fetch-like error response
    return new Response(error.message, {
      status: error.response?.status || 500,
      statusText: error.response?.statusText || 'Internal Server Error',
      headers: error.response?.headers as Record<string, string> | undefined,
    });
  }
};

/**
 * Execute a SUI API call with retry logic
 */
export const executeWithRetry = <T>(
  fn: () => Promise<T>,
  customConfig?: Partial<RetryConfig>,
): Promise<T> => {
  return withRetry(fn, { ...SUI_API_RETRY_CONFIG, ...customConfig }, logger); // Use top-level logger
};

// --- Initialization Function ---
let isInitialized = false; // Flag to prevent double initialization
const initLogger = new Logger('SuiBlockchainInit');

export function initializeSuiBlockchainUtils(
  suiRpcUrls: string,
  proxies: string,
) {
  if (isInitialized) {
    initLogger.warn('SuiBlockchainUtils already initialized. Skipping.');
    return;
  }

  initLogger.log('Initializing SuiBlockchainUtils...');

  const DEFAULT_RPC = 'https://fullnode.mainnet.sui.io';

  SUI_NETWORK_CONNECTION_POOL = parseEnvList(suiRpcUrls, [DEFAULT_RPC]);
  PROXIES = parseEnvList(proxies, []);
  SUI_NETWORK_RPC = process.env.SUI_DEFAULT_RPC || DEFAULT_RPC;
  DEFAULT_SIGNER_HEX =
    process.env.SUI_DEFAULT_SIGNER_HEX ||
    '6d9b74ed12f7c14e3576caa51a939c503820d2721076f70664cac914100f513b';

  initLogger.log(
    `Loaded SUI RPC URLs (${SUI_NETWORK_CONNECTION_POOL.length}): ${
      SUI_NETWORK_CONNECTION_POOL.length > 0
        ? SUI_NETWORK_CONNECTION_POOL[0] +
          (SUI_NETWORK_CONNECTION_POOL.length > 1 ? ', ...' : '')
        : 'None'
    }`,
  );
  initLogger.log(
    `Loaded SUI Proxies (${PROXIES.length}): ${
      PROXIES.length > 0 ? 'Enabled' : 'Disabled'
    }`,
  );

  // Create Connection Pool
  initLogger.log('Creating SUI RPC connection pool with Axios fetch...');
  rpcProviderPools = []; // Reset pool
  SUI_NETWORK_CONNECTION_POOL.forEach((url) => {
    try {
      rpcProviderPools.push(
        new SuiClient({ url: url, fetch: customFetch } as any),
      );
    } catch (clientError) {
      initLogger.error(
        `Failed to create SuiClient for pool URL ${url}: ${clientError.message}`,
      );
    }
  });
  initLogger.log(
    `Created connection pool with ${rpcProviderPools.length} clients.`,
  );

  // Initialize the main client instance
  try {
    suiClient = new SuiClient({
      url: SUI_NETWORK_RPC,
      fetch: customFetch,
    } as any);
    initLogger.log(`Initialized main suiClient with URL: ${SUI_NETWORK_RPC}`);
  } catch (clientError) {
    initLogger.error(
      `Failed to create main suiClient for URL ${SUI_NETWORK_RPC}: ${clientError.message}`,
    );
    throw new Error(
      `Failed to initialize main SuiClient: ${clientError.message}`,
    );
  }

  // Validate pool creation
  if (
    rpcProviderPools.length === 0 &&
    SUI_NETWORK_CONNECTION_POOL.length > 0 &&
    SUI_NETWORK_CONNECTION_POOL[0] !== DEFAULT_RPC
  ) {
    initLogger.error(
      'SUI RPC provider pool is empty despite configuration! Check RPC URLs and network.',
    );
    // Decide if this should throw an error or just warn
    // throw new Error('Failed to create any clients for the SUI connection pool.');
  }

  isInitialized = true;
  initLogger.log('SuiBlockchainUtils initialization complete.');
}

// --- Other Utility Functions ---
// (Keep existing functions like getBalanceSafely, executeWithRetry, etc.)

// Modify functions relying on pool/client to check for initialization
export const getRandomRpcProvider = (): SuiClient => {
  if (!isInitialized || rpcProviderPools.length === 0) {
    throw new Error(
      'Sui RPC provider pool not initialized. Call initializeSuiBlockchainUtils() in main.ts first.',
    );
  }
  const randomIndex = random(0, rpcProviderPools.length - 1, false);
  return rpcProviderPools[randomIndex];
};

export const getCoinData = async (
  coinType: string,
  client?: SuiClient, // Allow passing a client
): Promise<CoinMetadata> => {
  const clientToUse = client || suiClient; // Use provided client or default
  if (!isInitialized || !clientToUse) {
    throw new Error(
      'SuiClient not initialized. Call initializeSuiBlockchainUtils() in main.ts first.',
    );
  }
  const coinData = await clientToUse.getCoinMetadata({
    coinType,
  });
  return coinData;
};

export const getOwnedCoin = async (
  address: string,
  coinType: string,
  filterOptions?: {
    amount?: bigint;
  },
): Promise<CoinObject[]> => {
  const coins: CoinObject[] = [];
  let hasNextPage = true;
  let nextCursor = null;

  let currentAmount = BigInt(0);
  while (hasNextPage) {
    // Use retry mechanism for getCoins API call
    const resp: any = await executeWithRetry(() =>
      suiClient.getCoins({
        owner: address,
        coinType,
        cursor: nextCursor,
      }),
    );

    resp.data.forEach((item: CoinStruct) => {
      const coinBalance = BigInt(item.balance);
      coins.push({
        type: item.coinType,
        objectId: item.coinObjectId,
        symbol: Coin.getCoinTypeSymbol(item.coinType),
        balance: coinBalance,
        lockedUntilEpoch: null,
        previousTransaction: item.previousTransaction,
        object: item,
      });
      currentAmount += coinBalance;
    });

    if (
      typeof filterOptions?.amount === 'bigint' &&
      currentAmount >= filterOptions.amount
    ) {
      break;
    }

    hasNextPage = resp.hasNextPage;
    nextCursor = resp.nextCursor;
  }
  return coins;
};

export const getDefaultSigner = (): Signer | null => {
  const secretKey = Buffer.from(DEFAULT_SIGNER_HEX, 'hex');
  const signer = Ed25519Keypair.fromSecretKey(secretKey);
  return signer;
};
export const getEvents = async (
  query: SuiEventFilter,
  cursor?: {
    txDigest: string;
    eventSeq: string;
  } | null,
  limit: number | null = 30,
  order: 'ascending' | 'descending' = 'ascending',
): Promise<any> => {
  return await suiClient.queryEvents({
    query: query,
    cursor: cursor,
    limit: limit,
    order: order,
  });
};

export const callContract = async (
  privateKeyHex: string,
  packageId: string,
  module: string,
  func: string,
  args: any,
): Promise<SuiTransactionBlockResponse> => {
  const secretKey = Buffer.from(privateKeyHex, 'hex');
  const keypair = Ed25519Keypair.fromSecretKey(secretKey);
  const tx = new TransactionBlock();
  tx.moveCall({
    target: `${packageId}::${module}::${func}`,
    arguments: args.map((x) => tx.pure(x)),
  });
  const result = await suiClient.signAndExecuteTransactionBlock({
    transactionBlock: tx,
    signer: keypair,
  });
  return result;
};

export const dryRunTransactionWithSigner = async (
  senderAddress: string,
  packageId: string,
  module: string,
  func: string,
  args: any,
): Promise<DryRunTransactionBlockResponse> => {
  const tx = new TransactionBlock();
  tx.add(
    Transactions.MoveCall({
      target: `${packageId}::${module}::${func}`,
      arguments: args.map((x) => tx.pure(x)),
    }),
  );
  tx.setSender(senderAddress);
  const serializedTx = await tx.build();
  const result = await suiClient.dryRunTransactionBlock({
    transactionBlock: serializedTx,
  });
  return result;
};

export const getGasCostEstimation = async (
  privateKeyHex: string,
  packageId: string,
  module: string,
  func: string,
  args: any,
): Promise<bigint> => {
  const secretKey = Buffer.from(privateKeyHex, 'hex');
  const keypair = Ed25519Keypair.fromSecretKey(secretKey);
  const tx = new TransactionBlock();
  tx.moveCall({
    target: `${packageId}::${module}::${func}`,
    arguments: args.map((x) => tx.pure(x)),
  });

  // 3. Set the sender
  tx.setSender(keypair.getPublicKey().toSuiAddress());

  // 4. Build the transaction block bytes using the client
  const txBytes = await tx.build({ client: suiClient });

  // 5. Simulate the transaction to estimate gas using dryRunTransactionBlock
  const resp = await suiClient.dryRunTransactionBlock({
    transactionBlock: txBytes,
  });

  // 6. Extract and return the gas used from the simulation result
  if (resp.effects?.status?.status !== 'success') {
    throw new Error('Transaction simulation failed');
  }
  return (
    BigInt(resp.effects.gasUsed.computationCost) +
    BigInt(resp.effects.gasUsed.storageCost)
  );
};

export const createRandomProvider = () => {
  const randomIndex = random(0, SUI_NETWORK_CONNECTION_POOL.length - 1, false);
  logger.warn(
    'createRandomProvider does not use the proxy pool, consider using getRandomRpcProvider',
  );
  return new SuiClient({
    url: SUI_NETWORK_CONNECTION_POOL[randomIndex],
    // Note: No proxy used here unless you add fetch: customFetch
  });
};

/**
 * Checks the status of all nodes in the connection pool
 * @returns {Promise<{active: string[], inactive: string[]}>} Lists of active and inactive nodes
 * @throws {Error} If any node is inactive
 */
export const checkNodesStatus = async (): Promise<{
  active: string[];
  inactive: string[];
}> => {
  logger.log('Checking status of SUI network nodes via Axios fetch...');

  const activeNodes: string[] = [];
  const inactiveNodes: string[] = [];

  if (
    !SUI_NETWORK_CONNECTION_POOL ||
    SUI_NETWORK_CONNECTION_POOL.length === 0
  ) {
    throw new Error('SUI_NETWORK_CONNECTION_POOL is empty or not configured');
  }

  const nodeStatusPromises = SUI_NETWORK_CONNECTION_POOL.map(async (url) => {
    try {
      // Create a temporary client with proxy for the check
      // Cast constructor options to any
      const client = new SuiClient({ url, fetch: customFetch } as any);
      const response = await executeWithRetry(() =>
        client.getLatestCheckpointSequenceNumber(),
      );

      if (response) {
        logger.log(`Node ${url} is active, latest checkpoint: ${response}`);
        activeNodes.push(url);
        return { url, active: true };
      } else {
        logger.error(`Node ${url} returned an invalid response`);
        inactiveNodes.push(url);
        return { url, active: false };
      }
    } catch (error) {
      logger.error(`Node ${url} is inactive: ${error.message}`);
      inactiveNodes.push(url);
      return { url, active: false };
    }
  });

  await Promise.all(nodeStatusPromises);

  logger.log(
    `Node status check complete. Active: ${activeNodes.length}, Inactive: ${inactiveNodes.length}`,
  );

  if (inactiveNodes.length > 0) {
    throw new Error(
      `The following SUI nodes are inactive: ${inactiveNodes.join(', ')}`,
    );
  }

  return { active: activeNodes, inactive: inactiveNodes };
};

export const importWallet = (privateKeyHex: string): SuiWallet => {
  const secretKey = Buffer.from(privateKeyHex, 'hex');
  const ed25519Keypair = Ed25519Keypair.fromSecretKey(secretKey);
  return {
    address: ed25519Keypair.getPublicKey().toSuiAddress(),
    privateKeyHex: privateKeyHex,
    publicKey: ed25519Keypair.getPublicKey().toSuiBytes(),
    privateKey: secretKey,
  };
};

export const isSui = (coinType: string): boolean => {
  if (coinType === SUI_TYPE_ARG) {
    return true;
  }
  return false;
};

export const getDecimals = async (coinType: string): Promise<number> => {
  if (isSui(coinType)) {
    return SUI_DECIMALS;
  }
  const client = getRandomRpcProvider();
  const coinData = await getCoinData(coinType, client);
  return coinData.decimals;
};

export const calculateGasFeeInfo = (
  gasUsedInfo: any,
): { totalGasFee: string; netGasFee: string } => {
  const totalGas = new bignum.BN(gasUsedInfo?.computationCost || 0).add(
    new bignum.BN(gasUsedInfo?.storageCost || 0),
  );
  const netGas = totalGas.sub(new bignum.BN(gasUsedInfo?.storageRebate || 0));
  return {
    totalGasFee: totalGas.toString(),
    netGasFee: netGas.toString(),
  };
};

export const getBalanceSafely = async (
  params: { owner: string; coinType: string },
  client: SuiClient,
) => {
  if (!client) throw new Error('SuiClient not provided for getBalanceSafely');
  return executeWithRetry(() => client.getBalance(params));
};

export const executeTransactionWithRetry = async (
  params: {
    transactionBlock: TransactionBlock | Uint8Array;
    signer: Signer;
    options?: SuiTransactionBlockResponseOptions;
    requestType?: ExecuteTransactionRequestType;
  },
  client: SuiClient,
): Promise<SuiTransactionBlockResponse> => {
  if (!client)
    throw new Error('SuiClient not provided for executeTransactionWithRetry');
  return executeWithRetry(() => client.signAndExecuteTransactionBlock(params));
};

export const multiSend = async (
  coinType: string,
  wallets: { address: string; amount: string }[],
  signer?: Signer,
): Promise<{ transactionHash: string }> => {
  try {
    const client = getRandomRpcProvider();
    const sender = signer || getDefaultSigner();

    if (!sender) {
      throw new Error('No signer provided and no default signer available');
    }

    const senderAddress = sender.getPublicKey().toSuiAddress();
    const tx = new TransactionBlock();

    // Calculate total amount and prepare amounts array
    let totalAmount = BigInt(0);
    const pAmounts = wallets.map((wallet) => {
      totalAmount += BigInt(wallet.amount);
      return tx.pure(wallet.amount);
    });

    // Get coins for transfer
    const coins = await getOwnedCoin(senderAddress, coinType, {
      amount: totalAmount,
    });
    if (!coins || coins.length === 0) {
      throw new Error(`No ${coinType} coins found for sender ${senderAddress}`);
    }

    // Handle transfers based on coin type
    let transferCoins;
    if (coinType === SUI_TYPE_ARG) {
      transferCoins = tx.splitCoins(tx.gas, pAmounts);
    } else {
      const [primaryCoin, ...mergeCoins] = coins.filter(
        (coin) => coin.type === coinType,
      );
      const primaryCoinInput = tx.object(primaryCoin.objectId);

      if (mergeCoins.length) {
        tx.mergeCoins(
          primaryCoinInput,
          mergeCoins.map((coin) => tx.object(coin.objectId)),
        );
      }
      transferCoins = tx.splitCoins(primaryCoinInput, pAmounts);
    }

    // Create transfer transactions
    wallets.forEach((wallet, i) => {
      tx.transferObjects([transferCoins[i]], tx.pure(wallet.address));
    });

    // Execute transaction
    const response = await executeTransactionWithRetry(
      {
        transactionBlock: tx,
        signer: sender,
        options: {
          showEffects: true,
          showEvents: true,
        },
      },
      client,
    );

    if (response.effects?.status.status !== 'success') {
      throw new Error(`Transaction failed: ${response.effects?.status.error}`);
    }

    return {
      transactionHash: response.digest,
    };
  } catch (error) {
    logger.error(`Multi-send failed: ${error.message}`);
    throw error;
  }
};
