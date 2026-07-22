import mongoose, { Schema, Document } from 'mongoose';

export interface IRoom {
  _id: string;
  id: string;
  floorId: string;
  buildingId: string;
  name: string;
  type: string;
  qrToken: string;
  isDeleted: boolean;
  deletedAt?: Date;
}

const RoomSchema = new Schema<IRoom>({
  _id: { type: String, required: true },
  id: { type: String, required: true, unique: true, index: true },
  floorId: { type: String, required: true, index: true },
  buildingId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  type: { type: String, required: true },
  qrToken: { type: String, required: true },
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date }
}, {
  timestamps: true,
  versionKey: false
});

export const RoomModel = (mongoose.models.Room as mongoose.Model<IRoom>) || mongoose.model<IRoom>('Room', RoomSchema);
