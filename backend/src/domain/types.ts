import {
  IsNumber,
  IsPositive,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
} from 'class-validator';

export interface SwapData {
  sellToken: string;
  buyToken: string;
  sellAmount: string;
  buyAmount: string;
  slippage: string;
}

export interface MMSwapData {
  sellToken: string;
  buyToken: string;
  sellAmount: string;
  buyAmount: string;
  slippage: string;
}

export interface AddLiquidityData {
  token0: string;
  token1: string;
  amount0: string;
  amount1: string;
}

export interface RemoveLiquidityData {
  token0: string;
  token1: string;
  amount0: string;
  amount1: string;
}

export class DeployContractData {
  contractAddress: string;
  contractAbi: string;
  contractBytecode: string;
}

export class QuickSellSetting {
  minAmount: number;
  maxAmount: number;
  slippage: number;
}

export class QuickBuySetting {
  @IsNumber()
  minAmount: number;

  @IsNumber()
  maxAmount: number;

  @IsNumber()
  slippage: number;
}

export class QuickSwapSetting {
  @IsNumber()
  minAmount: number;

  @IsNumber()
  maxAmount: number;

  @IsNumber()
  slippage: number;
}

export class KeepTargetPriceSetting {
  @IsNumberString()
  @IsNotEmpty()
  targetPrice: string;

  @IsNumber()
  @IsPositive()
  @IsNotEmpty()
  priceTolerancePercent: number; // e.g., 0.5 for +/- 0.5%

  @IsNumber()
  @IsPositive()
  @IsNotEmpty()
  durationHours: number;

  @IsNumber()
  @IsNotEmpty()
  minAmount: number; // Min amount per trade

  @IsNumber()
  @IsNotEmpty()
  maxAmount: number; // Max amount per trade

  @IsNumber()
  @IsNotEmpty()
  slippage: number;
}

export class KeepTargetVolumeSetting {
  @IsNumberString()
  @IsNotEmpty()
  targetVolumeAmount: string;

  @IsNumber()
  @IsPositive()
  @IsNotEmpty()
  durationHours: number;

  @IsNumber()
  @IsNotEmpty()
  minAmount: number; // Min amount per trade

  @IsNumber()
  @IsNotEmpty()
  maxAmount: number; // Max amount per trade

  @IsNumber()
  @IsNotEmpty()
  slippage: number;

  // Optional: targetPrice if volume needs to be achieved around a specific price
  @IsOptional()
  @IsNumberString()
  targetPrice?: string;
}
