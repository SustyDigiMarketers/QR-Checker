import mongoose, { Schema, Document } from 'mongoose';

export interface IQRCode {
  _id: string;
  id: string;
  roomId: string;
  token: string;
  generatedAt: Date;
  scansCount: number;
  lastScannedAt?: Date;
  status: string;
  isDeleted: boolean;
  deletedAt?: Date;
}

const QRCodeSchema = new Schema<IQRCode>({
  _id: { type: String, required: true },
  id: { type: String, required: true, unique: true, index: true },
  roomId: { type: String, required: true, unique: true, index: true },
  token: { type: String, required: true, index: true },
  generatedAt: { type: Date, default: Date.now },
  scansCount: { type: Number, default: 0 },
  lastScannedAt: { type: Date },
  status: { type: String, default: 'Active' },
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date }
}, {
  timestamps: true,
  versionKey: false
});

export const QRCodeModel = (mongoose.models.QRCode as mongoose.Model<IQRCode>) || mongoose.model<IQRCode>('QRCode', QRCodeSchema);
