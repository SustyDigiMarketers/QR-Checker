import mongoose, { Schema, Document } from 'mongoose';

export interface ISetting {
  _id: string;
  googleSheetsId: string;
  googleClientEmail: string;
  googlePrivateKey: string;
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  companyName: string;
  companyLogoUrl: string;
  autoSync: boolean;
  isDeleted: boolean;
  deletedAt?: Date;
}

const SettingSchema = new Schema<ISetting>({
  _id: { type: String, required: true },
  googleSheetsId: { type: String, default: '' },
  googleClientEmail: { type: String, default: '' },
  googlePrivateKey: { type: String, default: '' },
  smtpHost: { type: String, default: 'smtp.sendgrid.net' },
  smtpPort: { type: String, default: '587' },
  smtpUser: { type: String, default: 'apikey' },
  companyName: { type: String, default: 'CleanCheck Facility Logistics' },
  companyLogoUrl: { type: String, default: '' },
  autoSync: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date }
}, {
  timestamps: true,
  versionKey: false
});

export const SettingModel = (mongoose.models.Setting as mongoose.Model<ISetting>) || mongoose.model<ISetting>('Setting', SettingSchema);
