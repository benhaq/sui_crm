import BN from 'bn.js';
export class ExecuteSwapParams {
  buyToken: string;
  sellToken: string | '0x2::sui::SUI';
  sellAmount: string;
  taker?: string;
  slippageBps?: number;
}

export interface SwapTransactionResult {
  data: {
    digest: string;
    transactionDigest?: string; // Added for backward compatibility
    effects?: {
      status?: {
        status: string;
      };
      gasUsed?: {
        computationCost: string;
        storageCost: string;
        storageRebate: string;
      };
    };
    status?: {
      status: string;
    };
    gasUsed?: {
      computationCost: string;
      storageCost: string;
      storageRebate: string;
    };
    events?: any;
    balanceChanges?: any[];
    objectChanges?: any[];
    transaction?: any;
  } | null;
  poolAddress?: string;
  amountIn: BN;
  amountOut: bigint;
  routeInfo?: any;
  error?: string;
}
