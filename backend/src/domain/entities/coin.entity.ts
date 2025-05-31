import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { HydratedDocument } from 'mongoose';

export type TokenDocument = HydratedDocument<Token>;

@Schema({
  collection: 'tokens',
  timestamps: true,
  toJSON: {
    transform: function (doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    },
    getters: true,
  },
})
export class Token {
  @ApiProperty()
  @Prop({ required: true })
  address: string;

  @ApiProperty()
  @Prop({ required: true })
  name: string;

  @ApiProperty()
  @Prop({ required: true })
  symbol: string;

  @ApiProperty()
  @Prop({ default: 18 })
  decimals: number;

  @ApiProperty()
  @Prop({ required: true })
  totalSupply: number;

  @ApiProperty()
  @Prop({ default: '' })
  packageId: string;

  @ApiProperty()
  @Prop({ default: '' })
  coinType: string;

  @ApiProperty()
  @Prop({ default: '' })
  createdHash: string;

  @ApiProperty()
  @Prop({ default: '' })
  defaultHolder: string;
}

export const TokenSchema = SchemaFactory.createForClass(Token);
