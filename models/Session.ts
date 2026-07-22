import mongoose, { Schema, Document } from 'mongoose';

export interface ISession {
  _id: string;
  id: string;
  userId: string;
  expiresAt: Date;
  isDeleted: boolean;
  deletedAt?: Date;
}

const SessionSchema = new Schema<ISession>({
  _id: { type: String, required: true },
  id: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  expiresAt: { type: Date, required: true },
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date }
}, {
  timestamps: true,
  versionKey: false
});

export const SessionModel = (mongoose.models.Session as mongoose.Model<ISession>) || mongoose.model<ISession>('Session', SessionSchema);
