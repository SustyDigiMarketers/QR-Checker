import mongoose, { Schema, Document } from 'mongoose';

export interface IBuilding {
  _id: string;
  id: string;
  organizationId: string;
  name: string;
  address?: string;
  isDeleted: boolean;
  deletedAt?: Date;
}

const BuildingSchema = new Schema<IBuilding>({
  _id: { type: String, required: true },
  id: { type: String, required: true, unique: true, index: true },
  organizationId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  address: { type: String },
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date }
}, {
  timestamps: true,
  versionKey: false
});

export const BuildingModel = (mongoose.models.Building as mongoose.Model<IBuilding>) || mongoose.model<IBuilding>('Building', BuildingSchema);
