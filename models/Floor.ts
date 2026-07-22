import mongoose, { Schema, Document } from 'mongoose';

export interface IFloor {
  _id: string;
  id: string;
  buildingId: string;
  name: string;
  level: number;
  isDeleted: boolean;
  deletedAt?: Date;
}

const FloorSchema = new Schema<IFloor>({
  _id: { type: String, required: true },
  id: { type: String, required: true, unique: true, index: true },
  buildingId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  level: { type: Number, required: true },
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date }
}, {
  timestamps: true,
  versionKey: false
});

export const FloorModel = (mongoose.models.Floor as mongoose.Model<IFloor>) || mongoose.model<IFloor>('Floor', FloorSchema);
