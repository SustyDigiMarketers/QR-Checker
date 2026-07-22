import mongoose, { Schema, Document } from 'mongoose';

export interface IUser {
  _id: string;
  id: string;
  username: string;
  email: string;
  role: string;
  fullName: string;
  organizationId?: string;
  active: boolean;
  avatarUrl?: string;
  passwordHash?: string;
  salt?: string;
  failedLoginAttempts?: number;
  lockedUntil?: Date;
  lastLoginAt?: Date;
  lastLoginIp?: string;
  lastLoginDevice?: string;
  passwordChangedAt?: Date;
  passwordVersion?: number;
  migrationVersion?: number;
  isDeleted: boolean;
  deletedAt?: Date;
}

const UserSchema = new Schema<IUser>({
  _id: { type: String, required: true },
  id: { type: String, required: true, unique: true, index: true },
  username: { type: String, required: true, unique: true, index: true },
  email: { type: String, required: true, index: true },
  role: { type: String, required: true },
  fullName: { type: String, required: true },
  organizationId: { type: String, index: true },
  active: { type: Boolean, default: true },
  avatarUrl: { type: String },
  passwordHash: { type: String },
  salt: { type: String },
  failedLoginAttempts: { type: Number, default: 0 },
  lockedUntil: { type: Date },
  lastLoginAt: { type: Date },
  lastLoginIp: { type: String },
  lastLoginDevice: { type: String },
  passwordChangedAt: { type: Date },
  passwordVersion: { type: Number, default: 1 },
  migrationVersion: { type: Number, default: 0 },
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date }
}, {
  timestamps: true,
  versionKey: false
});

export const UserModel = (mongoose.models.User as mongoose.Model<IUser>) || mongoose.model<IUser>('User', UserSchema);
