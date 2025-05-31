import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AccountDocument = Account & Document;

@Schema({
  timestamps: true,
  collection: 'accounts',
  toJSON: {
    transform: (doc, ret) => {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
})
export class Account {
  @Prop({ required: false, default: '' })
  email: string;

  @Prop({ required: false, default: '' })
  suiWallet: string;

  @Prop({ required: true, default: true })
  active: boolean;

  @Prop({ required: true })
  nonce: string;

  @Prop({ required: true })
  username: string;

  @Prop({ required: false, default: '' })
  avatar: string;
}

export const AccountSchema = SchemaFactory.createForClass(Account);
