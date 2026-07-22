import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog {
  _id: string;
  id: string;
  userId: string;
  username: string;
  action: string;
  details: string;
  ipAddress?: string;
  isDeleted: boolean;
  deletedAt?: Date;
}

const AuditLogSchema = new Schema<IAuditLog>({
  _id: { type: String, required: true },
  id: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  username: { type: String, required: true },
  action: { type: String, required: true, index: true },
  details: { type: String, required: true },
  ipAddress: { type: String },
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date }
}, {
  timestamps: true,
  versionKey: false
});

export const AuditLogModel = (mongoose.models.AuditLog as mongoose.Model<IAuditLog>) || mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
