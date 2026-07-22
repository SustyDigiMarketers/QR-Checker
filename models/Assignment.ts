import mongoose, { Schema, Document } from 'mongoose';

export interface IAssignment {
  _id: string;
  id: string;
  inspectorId: string;
  inspectorName: string;
  roomIds: string[];
  shift: string;
  date: string; // YYYY-MM-DD
  isDeleted: boolean;
  deletedAt?: Date;
}

const AssignmentSchema = new Schema<IAssignment>({
  _id: { type: String, required: true },
  id: { type: String, required: true, unique: true, index: true },
  inspectorId: { type: String, required: true, index: true },
  inspectorName: { type: String, required: true },
  roomIds: { type: [String], required: true },
  shift: { type: String, required: true },
  date: { type: String, required: true, index: true },
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date }
}, {
  timestamps: true,
  versionKey: false
});

export const AssignmentModel = (mongoose.models.Assignment as mongoose.Model<IAssignment>) || mongoose.model<IAssignment>('Assignment', AssignmentSchema);
