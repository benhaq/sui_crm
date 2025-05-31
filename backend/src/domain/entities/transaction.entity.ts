import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import {
  SwapData,
  MMSwapData,
  AddLiquidityData,
  RemoveLiquidityData,
  DeployContractData,
} from '../types';
import { TransactionType } from '../enums';

export type TransactionDocument = Transaction & Document;

@Schema({
  timestamps: true,
  collection: 'transactions',
  toJSON: {
    transform: (doc, ret) => {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
})
export class Transaction {
  @Prop({ required: true })
  accountId: string;

  @Prop({ required: true })
  transactionHash: string;

  @Prop({ required: true })
  from: string;

  @Prop({ required: true })
  to: string;

  @Prop({ required: true, enum: TransactionType })
  type: TransactionType;

  @Prop({ required: false, type: Object })
  data:
    | SwapData
    | MMSwapData
    | AddLiquidityData
    | RemoveLiquidityData
    | DeployContractData;

  @Prop({ required: false })
  mmSettingId: string;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);
