import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Transaction, TransactionDocument } from 'src/domain';
import { Model } from 'mongoose';

@Injectable()
export class TransactionService {
  constructor(
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<TransactionDocument>,
  ) {}

  async create(transaction: TransactionDocument) {
    return this.transactionModel.create(transaction);
  }

  async findById(id: string) {
    return this.transactionModel.findById(id);
  }

  async findByHash(hash: string) {
    return this.transactionModel.findOne({ transactionHash: hash });
  }
}
