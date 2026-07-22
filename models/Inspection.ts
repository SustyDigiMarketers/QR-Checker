import mongoose, { Schema, Document } from 'mongoose';

export interface IInspection {
  _id: string;
  id: string;
  roomId: string;
  roomName: string;
  floorName: string;
  buildingName: string;
  organizationName: string;
  inspectorId: string;
  inspectorName: string;
  cleaned: boolean;
  rating: number;
  remarks: string;
  deviceTime: Date;
  photoUrl?: string;
  signatureUrl?: string;
  latitude?: number;
  longitude?: number;
  syncedToGoogleSheets: boolean;
  syncedAt?: Date;
  shift?: string;
  status?: string;
  receiptNumber?: string;
  supervisorRemarks?: string;
  verifiedAt?: Date;
  isDeleted: boolean;
  deletedAt?: Date;
}

const InspectionSchema = new Schema<IInspection>({
  _id: { type: String, required: true },
  id: { type: String, required: true, unique: true, index: true },
  roomId: { type: String, required: true, index: true },
  roomName: { type: String, required: true },
  floorName: { type: String, required: true },
  buildingName: { type: String, required: true },
  organizationName: { type: String, required: true },
  inspectorId: { type: String, required: true, index: true },
  inspectorName: { type: String, required: true },
  cleaned: { type: Boolean, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  remarks: { type: String, default: '' },
  deviceTime: { type: Date, required: true },
  photoUrl: { type: String },
  signatureUrl: { type: String },
  latitude: { type: Number },
  longitude: { type: Number },
  syncedToGoogleSheets: { type: Boolean, default: false },
  syncedAt: { type: Date },
  shift: { type: String },
  status: { type: String, default: 'Submitted' },
  receiptNumber: { type: String },
  supervisorRemarks: { type: String, default: '' },
  verifiedAt: { type: Date },
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date }
}, {
  timestamps: true,
  versionKey: false
});

InspectionSchema.index({ createdAt: -1 });
InspectionSchema.index({ deviceTime: -1 });

export const InspectionModel = (mongoose.models.Inspection as mongoose.Model<IInspection>) || mongoose.model<IInspection>('Inspection', InspectionSchema);
