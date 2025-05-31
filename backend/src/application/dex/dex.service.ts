import { Injectable, Logger } from '@nestjs/common';
import BN, * as bignum from 'bn.js';
import { Subject } from 'rxjs';
import CetusClmmSDK, { initCetusSDK } from '@cetusprotocol/cetus-sui-clmm-sdk';
import { SuiClient } from '@mysten/sui.js/client';
import { Signer } from '@mysten/sui.js/cryptography';
import { Aftermath } from 'aftermath-ts-sdk';
import crypto from 'crypto';
import { SwapTransactionResult } from './types';
import { ExecuteSwapParams } from './types';
import {
  checkNodesStatus,
  executeTransactionWithRetry,
  getDefaultSigner,
  getRandomRpcProvider,
  initializeSuiBlockchainUtils,
} from 'src/utils/sui-blockchain';
import { InjectAppConfig } from 'src/config';
import { AppConfiguration } from 'src/config';
const MINT_SWAP_ALL_AMOUNT = BigInt(1000);

@Injectable()
export class DexService {
  aftermath: Aftermath;
  cetusSdk: CetusClmmSDK;
  logger = new Logger('DexService');
  private initialized = false;

  constructor(
    @InjectAppConfig()
    private appConfig: AppConfiguration,
  ) {}

  async initialize() {
    if (this.initialized) {
      this.logger.log('DexService already initialized');
      return;
    }

    try {
      initializeSuiBlockchainUtils(
        this.appConfig.suiNetwork.connectionPool,
        this.appConfig.suiNetwork.proxies,
      ); // Initialize after app creation
      this.logger.log('Sui Blockchain Utilities Initialized Successfully.'); // Optional
      this.logger.log('Starting DexService initialization...');

      // Check nodes first
      this.logger.log('Checking SUI network nodes...');
      await this.checkNodesAndInitialize();

      // Initialize Cetus SDK
      this.logger.log('Initializing Cetus SDK...');
      this.cetusSdk = initCetusSDK({ network: 'mainnet' });

      // Initialize Aftermath SDK
      this.logger.log('Initializing Aftermath SDK...');
      this.aftermath = new Aftermath('MAINNET');
      await this.aftermath.init();

      // Verify aftermath is initialized
      if (!this.aftermath) {
        throw new Error('Aftermath SDK failed to initialize');
      }

      this.initialized = true;
      this.logger.log('DexService initialization completed successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize DexService: ${error.message}`);
      this.initialized = false;
      throw error;
    }
  }

  /**
   * Checks node status before initializing the service
   * Throws an error if any node is down
   */
  private async checkNodesAndInitialize() {
    try {
      this.logger.log(
        'Checking SUI network nodes before initializing service...',
      );

      // Check all nodes in the connection pool
      await checkNodesStatus();

      this.logger.log('Service initialization completed successfully');
    } catch (error) {
      this.logger.error(`Service initialization failed: ${error.message}`);
      throw error; // Re-throw to prevent service from starting with bad nodes
    }
  }

  async executeSwap(payload: ExecuteSwapParams, signer?: Signer) {
    const { sellToken, buyToken, sellAmount, slippageBps, taker } = payload;
    const slippage = slippageBps / 10000;
    try {
      // Verify aftermath is initialized
      if (!this.aftermath) {
        this.logger.error('Aftermath SDK not initialized');
        throw new Error('Aftermath SDK not initialized');
      }
      if (!signer) {
        signer = getDefaultSigner();
      }

      // Get optimal route from Aftermath router
      const router = this.aftermath.Router();
      if (!router) {
        this.logger.error('Failed to get Aftermath router');
        throw new Error('Failed to get Aftermath router');
      }

      const route = await router.getCompleteTradeRouteGivenAmountIn({
        coinInType: sellToken,
        coinOutType: buyToken,
        coinInAmount: BigInt(sellAmount),
      });

      if (!route) {
        throw new Error(
          `No liquidity available for ${sellToken} to ${buyToken}`,
        );
      }

      // Create the transaction block
      const txBlock = await router.getTransactionForCompleteTradeRoute({
        walletAddress: signer.toSuiAddress(),
        completeRoute: route,
        slippage: slippage || 0,
        customRecipient: taker,
      });

      // Execute transaction
      const result = await executeTransactionWithRetry(
        {
          transactionBlock: await txBlock.build(),
          signer,
          options: {
            showEffects: true,
            showEvents: true,
          },
        },
        getRandomRpcProvider(),
      );

      this.logger.log(
        `Swap execution successful for ${signer.toSuiAddress()}, txDigest: ${
          result.digest
        }`,
      );

      // Format response to match expected structure
      return {
        transactionHash: result.digest,
      };
    } catch (error) {
      this.logger.error(
        `Swap execution error for ${signer.toSuiAddress()}: ${error.message}`,
      );

      // Handle rate limiting specifically
      if (
        error.message?.toLowerCase()?.includes('429') ||
        error.message?.toLowerCase()?.includes('too many requests') ||
        error.message?.toLowerCase()?.includes('rate limit')
      ) {
        this.logger.warn(
          `Rate limiting detected during swap execution. Consider reducing swap frequency.`,
        );
      }

      if (
        error.message?.toLowerCase()?.includes('insufficient balance') ||
        error.message?.toLowerCase()?.includes('gas')
      ) {
        // Handle gas-specific errors
        return {
          transactionHash: null,
          error: error.message,
        };
      }
      return {
        transactionHash: null,
        error: error.message,
      };
    }
  }
  // async performSwap(payload: SwapTokenDto, jobName?: string): Promise<void> {
  //   try {
  //     const requestor = payload?.requestor?.toLowerCase();
  //     this.logger.log(
  //       `Starting swap operation for requestor: ${requestor}${
  //         jobName ? `, job: ${jobName}` : ''
  //       }`,
  //     );

  //     if (!jobName) {
  //       const processState = await this.swapProcessModel.findOne(
  //         {
  //           requestor,
  //         },
  //         {
  //           isProcessing: true,
  //         },
  //       );
  //       if (processState?.isProcessing) {
  //         this.logger.log(
  //           `Swap already in progress for requestor: ${requestor}, skipping`,
  //         );
  //         return;
  //       }
  //       await this.swapProcessModel.updateOne(
  //         {
  //           requestor,
  //         },
  //         {
  //           $set: {
  //             requestor: payload.requestor,
  //             isProcessing: true,
  //             killProcess: false,
  //             swapResult: '',
  //           },
  //         },
  //         { upsert: true },
  //       );
  //     }
  //     let { walletAddresses } = payload;
  //     walletAddresses = walletAddresses.map((w) => w?.toLowerCase());
  //     this.logger.log(`Using ${walletAddresses.length} wallets for swapping`);

  //     // find mmconfig for pool(poolAddress)
  //     const mmConfig = await this.adminService.getThresholdConfigById(
  //       payload.configId,
  //     );
  //     if (!mmConfig) {
  //       this.logger.error('MM Config not found');
  //       return;
  //     }
  //     this.logger.log(
  //       `Using config: ${mmConfig.name} (${mmConfig.id}), swapping ${
  //         mmConfig.swapAforB ? 'A for B' : 'B for A'
  //       }`,
  //     );

  //     // check if payload.walletAddresses is enough balance and gas to perform swap
  //     const wallets = await this.walletService.getWalletKeypairByAddresses(
  //       walletAddresses,
  //     );

  //     // Calculate slippage in decimal (e.g., 0.5% -> 0.005)
  //     const slippage = mmConfig.slippage / 100;

  //     // calculate stop index when sum of randomAmount reach to stopThreshold
  //     const decimals = mmConfig.swapAforB
  //       ? mmConfig.decimalsA
  //       : mmConfig.decimalsB;
  //     let stopThreshold = new bignum.BN(
  //       parseUnits(mmConfig.stopThreshold, decimals).toString(),
  //     );
  //     this.logger.log(
  //       `Stop threshold: ${
  //         mmConfig.stopThreshold
  //       } (${stopThreshold.toString()}), decimals: ${decimals}`,
  //     );

  //     const swapHistories = [];
  //     const swapTaskChanges = new Map<
  //       string,
  //       {
  //         tokenAChange: bigint;
  //         tokenBChange: bigint;
  //         gasUsed: bigint;
  //       }
  //     >();

  //     let counter = 0;
  //     const zero = new bignum.BN(0);

  //     while (
  //       stopThreshold.gt(zero) &&
  //       counter < Number(appConfiguration().suiNetwork.maxSwapAttempts)
  //     ) {
  //       if (!jobName) {
  //         const killProcess = await this.swapProcessModel
  //           .findOne({
  //             requestor,
  //           })
  //           .exec()
  //           .then((d) => d.killProcess);
  //         if (killProcess === true) {
  //           this.logger.log(`Swap process killed by user, stopping`);
  //           break;
  //         }
  //       } else {
  //         const taskInfo = await this.swapTasksModel
  //           .findOne(
  //             {
  //               jobList: {
  //                 $all: [jobName],
  //               },
  //               requestor,
  //               strategies: {
  //                 $all: [payload.configId],
  //               },
  //             },
  //             {
  //               status: true,
  //             },
  //           )
  //           .exec();
  //         this.logger.log(`Task info: ${JSON.stringify(taskInfo)}`);
  //         if (
  //           [SwapTaskStatus.CANCELED, SwapTaskStatus.COMPLETED].includes(
  //             taskInfo?.status,
  //           )
  //         ) {
  //           this.logger.log(`Task ${jobName} is ${taskInfo?.status}, stopping`);
  //           break;
  //         }
  //       }

  //       // Generate random amount for this swap
  //       let randomAmount = this.newRandAmount(
  //         +mmConfig.lowerBound,
  //         +mmConfig.upperBound,
  //         decimals,
  //       );

  //       // Don't exceed stop threshold
  //       if (randomAmount.gt(stopThreshold)) {
  //         randomAmount = stopThreshold;
  //       }

  //       // Select random wallet from the list
  //       const randWalletIdx = random(0, wallets.length - 1, false);
  //       const randomClient = this.suiUtils.createRandomProvider();
  //       const address = wallets[randWalletIdx]
  //         .getPublicKey()
  //         .toSuiAddress()
  //         .toLowerCase();

  //       this.logger.log(
  //         `Selected wallet: ${address}, random amount: ${randomAmount.toString()}`,
  //       );

  //       // Add SUI balance check before attempting swap - use the retry mechanism
  //       try {
  //         const suiBalance = await this.suiUtils.getBalanceSafely(
  //           {
  //             owner: address,
  //             coinType: '0x2::sui::SUI',
  //           },
  //           randomClient,
  //         );

  //         const minGasBudget = parseUnits(
  //           appConfiguration().suiNetwork.gasBudget || '0.01',
  //           9,
  //         );

  //         if (
  //           BigInt(suiBalance.totalBalance) < BigInt(minGasBudget.toString())
  //         ) {
  //           this.logger.warn(
  //             `Wallet ${address} has insufficient SUI for gas, skipping`,
  //           );
  //           continue; // Skip this wallet
  //         }
  //       } catch (balanceError) {
  //         this.logger.error(
  //           `Failed to check balance for ${address}: ${balanceError.message}`,
  //         );

  //         // If we've exhausted retries and still getting rate limit errors, add a cooling period
  //         if (
  //           balanceError.message?.includes('429') ||
  //           balanceError.message?.toLowerCase()?.includes('too many requests')
  //         ) {
  //           this.logger.warn(
  //             `Rate limiting detected, pausing operations for 30 seconds...`,
  //           );
  //           await new Promise((resolve) => setTimeout(resolve, 30000)); // 30 second cooldown
  //         }

  //         continue; // Skip this wallet as we couldn't verify balance
  //       }

  //       // Perform the swap using Aftermath SDK
  //       let retryCount = 0;
  //       let txEffect = null;

  //       while (retryCount < 3 && !txEffect?.data) {
  //         try {
  //           txEffect = await this.createSwapTx(
  //             wallets[randWalletIdx],
  //             randomClient,
  //             mmConfig.tokenAType,
  //             mmConfig.tokenBType,
  //             address,
  //             mmConfig.swapAforB,
  //             randomAmount,
  //             slippage,
  //           );
  //           if (!txEffect?.data) {
  //             this.logger.warn(
  //               `Swap attempt ${
  //                 retryCount + 1
  //               } failed for ${address}, retrying...`,
  //             );
  //             await this.sleepRand();
  //             retryCount++;
  //           }
  //         } catch (err) {
  //           this.logger.error(
  //             `Swap error on attempt ${retryCount + 1} for ${address}: ${
  //               err.message
  //             }`,
  //           );

  //           // If we're getting rate limit errors, add a longer pause
  //           if (
  //             err.message?.includes('429') ||
  //             err.message?.toLowerCase()?.includes('too many requests')
  //           ) {
  //             this.logger.warn(
  //               `Rate limiting detected during swap, pausing for ${
  //                 (retryCount + 1) * 5
  //               } seconds...`,
  //             );
  //             await new Promise((resolve) =>
  //               setTimeout(resolve, (retryCount + 1) * 5000),
  //             ); // Progressive backoff
  //           } else {
  //             await this.sleepRand();
  //           }

  //           retryCount++;
  //         }
  //       }

  //       if (txEffect?.data) {
  //         stopThreshold = stopThreshold.sub(randomAmount);
  //         this.logger.log(
  //           `Swap successful for ${address}, remaining threshold: ${stopThreshold.toString()}`,
  //         );

  //         // Log transaction digest for reference
  //         if (txEffect.data.digest) {
  //           this.logger.log(`Transaction digest: ${txEffect.data.digest}`);
  //         }
  //       } else {
  //         this.logger.error(`All swap attempts failed for ${address}`);
  //       }

  //       // Get gas info - prefer effects.gasUsed if available
  //       const gasInfo = txEffect?.data
  //         ? this.suiUtils.calculateGasFeeInfo(
  //             txEffect.data.effects?.gasUsed ||
  //               txEffect.data.gasUsed || {
  //                 computationCost: '0',
  //                 storageCost: '0',
  //                 storageRebate: '0',
  //               },
  //           )
  //         : {
  //             totalGasFee: '0',
  //             netGasFee: '0',
  //           };

  //       swapHistories.push({
  //         status: txEffect?.data?.effects?.status?.status
  //           ? SwapStatus[txEffect.data.effects.status.status]
  //           : txEffect?.data?.status?.status
  //           ? SwapStatus[txEffect.data.status.status]
  //           : SwapStatus.failure,
  //         txDigest: txEffect?.data?.digest || null,
  //         address: address,
  //         gasInfo,
  //         swapAforB: mmConfig.swapAforB,
  //         configId: payload.configId,
  //         configName: mmConfig.name,
  //         requestor,
  //         jobName,
  //         routeInfo: txEffect?.routeInfo || null,
  //       });

  //       if (
  //         jobName &&
  //         txEffect?.data &&
  //         (txEffect.data.effects?.status?.status === 'success' ||
  //           txEffect.data.status?.status === 'success')
  //       ) {
  //         const { amountIn, amountOut } = txEffect;

  //         // Calculate gas used - prefer effects.gasUsed if available
  //         const txGasUsed = txEffect.data.effects?.gasUsed
  //           ? BigInt(txEffect.data.effects.gasUsed.computationCost) +
  //             BigInt(txEffect.data.effects.gasUsed.storageCost)
  //           : txEffect.data.gasUsed
  //           ? BigInt(txEffect.data.gasUsed.computationCost) +
  //             BigInt(txEffect.data.gasUsed.storageCost)
  //           : BigInt(0);

  //         if (swapTaskChanges.get(address)) {
  //           const { tokenAChange, tokenBChange, gasUsed } =
  //             swapTaskChanges.get(address);

  //           swapTaskChanges.set(address, {
  //             tokenAChange: mmConfig.swapAforB
  //               ? tokenAChange + BigInt(amountIn.toString())
  //               : tokenAChange - BigInt(amountOut.toString()),
  //             tokenBChange: mmConfig.swapAforB
  //               ? tokenBChange - BigInt(amountOut.toString())
  //               : tokenBChange + BigInt(amountIn.toString()),
  //             gasUsed: gasUsed + txGasUsed,
  //           });
  //         } else {
  //           swapTaskChanges.set(address, {
  //             tokenAChange: mmConfig.swapAforB
  //               ? BigInt(amountIn.toString())
  //               : -BigInt(amountOut.toString()),
  //             tokenBChange: mmConfig.swapAforB
  //               ? -BigInt(amountOut.toString())
  //               : BigInt(amountIn.toString()),
  //             gasUsed: txGasUsed,
  //           });
  //         }
  //       }

  //       await this.swapHistoryModel.create([
  //         swapHistories[swapHistories.length - 1],
  //       ]);
  //       counter++;

  //       // Add some random delay between swaps
  //       await this.sleepRand();
  //     }

  //     if (jobName && swapTaskChanges.size > 0) {
  //       const changes: Array<any> = [];

  //       swapTaskChanges.forEach((value, key) => {
  //         changes.push({
  //           jobName,
  //           address: key,
  //           tokenAChange: value.tokenAChange.toString(),
  //           tokenBChange: value.tokenBChange.toString(),
  //           gasUsed: value.gasUsed.toString(),
  //           tokenAName: mmConfig.name + ' Token A',
  //           tokenBName: mmConfig.name + ' Token B',
  //           tokenASymbol: 'A',
  //           tokenBSymbol: 'B',
  //           configId: payload.configId,
  //         });
  //       });

  //       await this.swapTaskChangeModel.create(changes);
  //     }

  //     if (!jobName) {
  //       await this.swapProcessModel.updateOne(
  //         {
  //           requestor,
  //         },
  //         {
  //           $set: {
  //             isProcessing: false,
  //             swapResult: `Completed with ${counter} swaps executed`,
  //           },
  //         },
  //       );
  //     }
  //   } catch (error) {
  //     this.logger.error(`Error in performSwap: ${error.message}`, error.stack);

  //     if (!jobName) {
  //       await this.swapProcessModel.updateOne(
  //         {
  //           requestor: payload.requestor.toLowerCase(),
  //         },
  //         {
  //           $set: {
  //             isProcessing: false,
  //             swapResult: `Failed with error: ${error.message}`,
  //           },
  //         },
  //       );
  //     }
  //   }
  // }

  newRandAmount(lowerBound: number, upperBound: number, decimals: number) {
    const pow = Math.pow(10, decimals);
    const rand = crypto.randomInt(lowerBound * pow, upperBound * pow);
    return new bignum.BN(rand);
  }

  async sleepRand(): Promise<any> {
    const ms = crypto.randomInt(1000, 5000);
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async createSwapTx(
    signer: Signer,
    client: SuiClient,
    coinTypeA: string,
    coinTypeB: string,
    signerAddress: string,
    swapAforB: boolean,
    swapAmount: BN,
    slippage: number,
  ): Promise<SwapTransactionResult> {
    try {
      // Determine input and output coin types based on swap direction
      const coinInType = swapAforB ? coinTypeA : coinTypeB;
      const coinOutType = swapAforB ? coinTypeB : coinTypeA;

      this.logger.log(
        `Creating swap transaction from ${coinInType} to ${coinOutType} for wallet ${signerAddress}`,
      );

      // Get optimal route from Aftermath router
      const router = this.aftermath.Router();

      const route = await router.getCompleteTradeRouteGivenAmountIn({
        coinInType,
        coinOutType,
        coinInAmount: BigInt(swapAmount.toString()),
      });

      if (!route) {
        this.logger.error(
          `No swap routes found for ${coinInType} to ${coinOutType}`,
        );
        return { data: null, amountIn: swapAmount, amountOut: BigInt(0) };
      }

      this.logger.log(
        `Found route for ${signerAddress}: ${coinInType} to ${coinOutType}, amount: ${swapAmount.toString()}, expected out: ${route.coinOut.amount.toString()}`,
      );

      // Store basic route info for logging
      this.logger.log(`Route details: Spot price: ${route.spotPrice || 'N/A'}`);

      // Create a basic route info object with the guaranteed properties
      const routeInfo = {
        coinInType,
        coinOutType,
        coinInAmount: swapAmount.toString(),
        coinOutAmount: route.coinOut.amount.toString(),
        spotPrice: route.spotPrice || 0,
        routes: [],
        netTradeFeePercentage: route.netTradeFeePercentage || 0,
      };

      // Try to extract route data in a type-safe way
      try {
        // Check if routes array exists directly on the route object
        if (route.routes && Array.isArray(route.routes)) {
          this.logger.log(`Found ${route.routes.length} routes in the data`);

          // Extract route information from each route
          routeInfo.routes = route.routes.flatMap((r) => {
            if (r.paths && Array.isArray(r.paths)) {
              this.logger.log(`Processing route with ${r.paths.length} paths`);

              // Extract data from each path in the route
              return r.paths.map((path) => {
                return {
                  protocol: path.protocolName || 'unknown',
                  poolAddress: path.poolId || 'unknown',
                  coinInType: path.coinIn?.type || 'unknown',
                  coinOutType: path.coinOut?.type || 'unknown',
                  spotPrice: path.spotPrice || 0,
                };
              });
            } else {
              this.logger.warn('Route does not contain paths array');
              return [];
            }
          });

          // If we still don't have any routes, try a fallback approach
          if (routeInfo.routes.length === 0) {
            this.logger.warn(
              'No routes extracted, trying fallback route parsing',
            );
            routeInfo.routes = [
              {
                protocol:
                  route.routes[0]?.paths?.[0]?.protocolName || 'unknown',
                poolAddress: route.routes[0]?.paths?.[0]?.poolId || 'unknown',
              },
            ];
          }
        } else {
          this.logger.warn(
            'Route object does not contain routes array, using fallback',
          );
          // Fallback for different structure
          routeInfo.routes = [
            {
              protocol: 'aftermath_aggregator',
              poolAddress: 'multi_route',
            },
          ];
        }
      } catch (err) {
        this.logger.error(
          `Error processing route details: ${err.message}`,
          err.stack,
        );
        // Provide fallback information
        routeInfo.routes = [
          {
            protocol: 'aftermath_aggregator',
            poolAddress: 'parsing_error',
          },
        ];
      }

      this.logger.log(
        `Final extracted routes: ${JSON.stringify(routeInfo.routes)}`,
      );

      // Create the transaction block
      const txBlock = await router.getTransactionForCompleteTradeRoute({
        walletAddress: signerAddress,
        completeRoute: route,
        slippage,
      });

      // Execute transaction
      try {
        const result = await executeTransactionWithRetry(
          {
            transactionBlock: await txBlock.build(),
            signer,
            options: {
              showEffects: true,
              showEvents: true,
            },
          },
          client,
        );

        this.logger.log(
          `Swap execution successful for ${signerAddress}, txDigest: ${result.digest}`,
        );

        // Ensure proper fields are set for transaction digest and gas used
        const transactionData = {
          ...result,
          transactionDigest: result.digest, // Ensure this field is set for backward compatibility
          gasUsed: result.effects?.gasUsed || {
            computationCost: '0',
            storageCost: '0',
            storageRebate: '0',
          },
        };

        // Format response to match expected structure
        return {
          data: transactionData,
          poolAddress: 'aftermath_aggregator',
          amountIn: swapAmount,
          amountOut: BigInt(route.coinOut.amount.toString()),
          routeInfo,
        };
      } catch (txError) {
        this.logger.error(
          `Transaction execution failed for ${signerAddress}: ${txError.message}`,
        );
        throw txError; // Re-throw to be caught by the outer try-catch
      }
    } catch (error) {
      this.logger.error(
        `Swap execution error for ${signerAddress}: ${error.message}`,
      );

      // Handle rate limiting specifically
      if (
        error.message?.toLowerCase()?.includes('429') ||
        error.message?.toLowerCase()?.includes('too many requests') ||
        error.message?.toLowerCase()?.includes('rate limit')
      ) {
        this.logger.warn(
          `Rate limiting detected during swap execution. Consider reducing swap frequency.`,
        );
      }

      if (
        error.message?.toLowerCase()?.includes('insufficient balance') ||
        error.message?.toLowerCase()?.includes('gas')
      ) {
        // Handle gas-specific errors
        return {
          data: null,
          error: 'gas_error',
          amountIn: swapAmount,
          amountOut: BigInt(0),
        };
      }
      return {
        data: null,
        error: error.message,
        amountIn: swapAmount,
        amountOut: BigInt(0),
      };
    }
  }

  // async getSwapHistories(
  //   params: GetSwapHistories,
  // ): Promise<BaseResult<SwapHistoryDto>> {
  //   try {
  //     const filter: any = {
  //       requestor: params.requestor.toLowerCase(),
  //     };
  //     if (params.status !== undefined) {
  //       filter.status = params.status;
  //     }
  //     if (params.address) {
  //       filter.address = params.address.toLowerCase();
  //     }
  //     if (params.txDigest) {
  //       filter.txDigest = params.txDigest;
  //     }

  //     // Get total count for pagination
  //     const totalCount = await this.swapHistoryModel.countDocuments(filter);

  //     // Apply pagination using parameters from GetSwapHistories
  //     const page = params.page || 1;
  //     const limit = params.limit || 10;
  //     const skip = (page - 1) * limit;

  //     // Get data with pagination
  //     const result = await this.swapHistoryModel
  //       .find(filter)
  //       .sort({ _id: -1 })
  //       .skip(skip)
  //       .limit(limit);

  //     // Transform to SwapHistoryRecord format
  //     const items = result.map((d) => ({
  //       id: d._id.toString(),
  //       status: d.status,
  //       address: d.address,
  //       txDigest: d.txDigest,
  //       configName: d.configName,
  //       swapAforB: d.swapAforB || false,
  //       gasInfo: d.gasInfo || {
  //         totalGasFee: '0',
  //         netGasFee: '0',
  //       },
  //       routeInfo: d.routeInfo || null,
  //     }));

  //     // Get coinA and coinB from mmConfig
  //     let coinA = '';
  //     let coinB = '';

  //     // Get the first configId in the results to fetch the corresponding mmConfig
  //     if (result.length > 0 && result[0].configId) {
  //       const mmConfig = await this.adminService.getThresholdConfigById(
  //         result[0].configId,
  //       );
  //       if (mmConfig) {
  //         coinA = mmConfig.tokenAType || '';
  //         coinB = mmConfig.tokenBType || '';
  //       }
  //     }

  //     // Calculate pagination values
  //     const totalPages = Math.ceil(totalCount / limit);

  //     // Create response with pagination structure
  //     const data: SwapHistoryDto = {
  //       items,
  //       coinA,
  //       coinB,
  //       total: +totalCount,
  //       page: +page || 1,
  //       limit: +limit || 10,
  //       totalPages: +totalPages || 0,
  //       currentPage: +page || 1,
  //       hasNextPage: +page < +totalPages,
  //       hasPreviousPage: +page > 1,
  //     };

  //     return {
  //       success: true,
  //       message: 'success',
  //       data,
  //     };
  //   } catch (error) {
  //     this.logger.error(
  //       `Error in getSwapHistories: ${error.message}`,
  //       error.stack,
  //     );
  //     return {
  //       success: false,
  //       message: error.message,
  //       data: {
  //         items: [],
  //         coinA: '',
  //         coinB: '',
  //         total: 0,
  //         page: 1,
  //         limit: 10,
  //         totalPages: 0,
  //         currentPage: 1,
  //         hasNextPage: false,
  //         hasPreviousPage: false,
  //       },
  //     };
  //   }
  // }

  // async deleteFailSwapHistories(
  //   payload: DeleteFailSwapHistoriesDto,
  // ): Promise<BaseResult<any>> {
  //   try {
  //     const filter: any = {
  //       status: SwapStatus.failure,
  //       requestor: payload.requestor.toLowerCase(),
  //     };
  //     const result = await this.swapHistoryModel.deleteMany(filter);
  //     return {
  //       success: true,
  //       message: 'success',
  //       data: {
  //         deletedCount: result?.deletedCount || 0,
  //       },
  //     };
  //   } catch (error) {
  //     this.logger.error(
  //       `Error in deleteFailSwapHistories: ${error.message}`,
  //       error.stack,
  //     );
  //     return {
  //       success: false,
  //       message: error.message,
  //       data: null,
  //     };
  //   }
  // }

  // async swapAllToken(payload: SwapAllTokenDto) {
  //   try {
  //     const { requestor, swapAforB, slippage, coinTypeA, coinTypeB } = payload;
  //     const wallets = await this.walletService.getAllWalletsByOwner(requestor);

  //     if (!wallets || wallets.length === 0) {
  //       this.logger.error('No wallets found for requestor');
  //       return {
  //         success: false,
  //         message: 'No wallets found for requestor',
  //         data: null,
  //       };
  //     }

  //     const swapResults = [];

  //     for (let i = 0; i < wallets.length; i++) {
  //       const { address, keypair } = wallets[i];
  //       const randClient = this.suiUtils.createRandomProvider();
  //       try {
  //         const router = this.aftermath.Router();

  //         // Determine input and output coin types
  //         const coinInType = swapAforB ? coinTypeA : coinTypeB;
  //         const coinOutType = swapAforB ? coinTypeB : coinTypeA;

  //         // Get all coins of the input type for this wallet
  //         const ownedCoins = await this.suiUtils.getOwnedCoin(
  //           address,
  //           coinInType,
  //         );

  //         if (!ownedCoins || ownedCoins.length === 0) {
  //           swapResults.push({
  //             address,
  //             status: 'NO_COINS',
  //             txDigest: null,
  //           });
  //           continue;
  //         }

  //         // Calculate total amount to swap
  //         let totalAmount = BigInt(0);
  //         for (const coin of ownedCoins) {
  //           totalAmount += BigInt(coin.balance);
  //         }

  //         // Reserve some coins for gas
  //         const gasReserve = BigInt(MINT_SWAP_ALL_AMOUNT);
  //         if (coinInType === '0x2::sui::SUI' && totalAmount > gasReserve) {
  //           totalAmount -= gasReserve;
  //         }

  //         if (totalAmount <= BigInt(0)) {
  //           swapResults.push({
  //             address,
  //             status: 'INSUFFICIENT_BALANCE',
  //             txDigest: null,
  //           });
  //           continue;
  //         }

  //         // Get optimal route
  //         const route = await router.getCompleteTradeRouteGivenAmountIn({
  //           coinInType,
  //           coinOutType,
  //           coinInAmount: totalAmount,
  //         });

  //         if (!route) {
  //           swapResults.push({
  //             address,
  //             status: 'NO_ROUTE',
  //             txDigest: null,
  //           });
  //           continue;
  //         }

  //         // Create transaction
  //         const txBlock = await router.getTransactionForCompleteTradeRoute({
  //           walletAddress: address,
  //           completeRoute: route,
  //           slippage: slippage / 100, // Convert percentage to decimal
  //         });

  //         // Execute transaction
  //         const result = await randClient.signAndExecuteTransactionBlock({
  //           transactionBlock: await txBlock.build(),
  //           signer: keypair,
  //           options: {
  //             showEffects: true,
  //             showEvents: true,
  //           },
  //         });

  //         swapResults.push({
  //           address,
  //           status: 'SUCCESS',
  //           txDigest: result.digest,
  //         });
  //       } catch (err) {
  //         this.logger.error(
  //           `Error in swapAllToken for address ${address}: ${err.message}`,
  //           err.stack,
  //         );

  //         swapResults.push({
  //           address,
  //           status: 'ERROR',
  //           error: err.message,
  //           txDigest: null,
  //         });
  //       }
  //     }

  //     return {
  //       success: true,
  //       message: 'success',
  //       data: swapResults,
  //     };
  //   } catch (error) {
  //     this.logger.error(`Error in swapAllToken: ${error.message}`, error.stack);
  //     return {
  //       success: false,
  //       message: error.message,
  //       data: null,
  //     };
  //   }
  // }

  // async getSwapState(address: string): Promise<BaseResult<any>> {
  //   try {
  //     address = address.toLowerCase();
  //     const state = await this.swapProcessModel.findOne({
  //       requestor: address,
  //     });
  //     return {
  //       success: true,
  //       message: 'success',
  //       data: {
  //         isProcessing: state?.isProcessing || false,
  //         swapResult: state?.swapResult || '',
  //       },
  //     };
  //   } catch (error) {
  //     this.logger.error(`Error in getSwapState: ${error.message}`, error.stack);
  //     return {
  //       success: false,
  //       message: error.message,
  //       data: null,
  //     };
  //   }
  // }

  // async killSwapProcess(address: string) {
  //   try {
  //     address = address.toLowerCase();
  //     await this.swapProcessModel.updateOne(
  //       {
  //         requestor: address,
  //       },
  //       {
  //         $set: {
  //           killProcess: true,
  //         },
  //       },
  //     );
  //     return {
  //       success: true,
  //       message: 'success',
  //       data: null,
  //     };
  //   } catch (error) {
  //     this.logger.error(
  //       `Error in killSwapProcess: ${error.message}`,
  //       error.stack,
  //     );
  //     return {
  //       success: false,
  //       message: error.message,
  //       data: null,
  //     };
  //   }
  // }

  // async getSwapSummaryByTask(
  //   taskInfo: SwapTask,
  //   queryParams: QuerySwapSummary,
  // ): Promise<PaginationDto<SwapTaskChanges>> {
  //   try {
  //     const { page, size, orderBy, desc } = queryParams;
  //     const filter: any = {
  //       jobName: { $in: taskInfo.jobList },
  //       configId: { $in: taskInfo.strategies },
  //     };
  //     // We don't use the taskId here so we're not checking for address param
  //     const skip = (page - 1) * size;
  //     const total = await this.swapTaskChangeModel.countDocuments(filter);
  //     const items = await this.swapTaskChangeModel
  //       .find(filter)
  //       .skip(skip)
  //       .limit(size)
  //       .sort({ _id: -1 });

  //     return new PaginationDto<SwapTaskChanges>(items, total, page, size);
  //   } catch (error) {
  //     this.logger.error(
  //       `Error in getSwapSummaryByTask: ${error.message}`,
  //       error.stack,
  //     );
  //     throw error;
  //   }
  // }
}
