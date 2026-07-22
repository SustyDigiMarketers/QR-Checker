import mongoose, { Schema, Document } from 'mongoose';

export interface IOrganization {
  _id: string;
  id: string;
  name: string;
  code: string;
  active: boolean;
  address?: string;
  contactEmail?: string;
  isDeleted: boolean;
  deletedAt?: Date;
}

const OrganizationSchema = new Schema<IOrganization>({
  _id: { type: String, required: true },
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true, index: true },
  active: { type: Boolean, default: true },
  address: { type: String },
  contactEmail: { type: String },
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date }
}, {
  timestamps: true,
  versionKey: false
});

export const OrganizationModel = (mongoose.models.Organization as mongoose.Model<IOrganization>) || mongoose.model<IOrganization>('Organization', OrganizationSchema);
