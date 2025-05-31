import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SystemConfigDocument = SystemConfig & Document;

@Schema({
  timestamps: true,
  collection: 'system_configs',
  toJSON: {
    transform: (doc, ret) => {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
})
export class SystemConfig {
  @Prop({ required: true })
  salaryInfoBlobId: string;

  @Prop({ required: true })
  owner: string;
}

export const SystemConfigSchema = SchemaFactory.createForClass(SystemConfig);
