import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['patient', 'staff', 'admin'], default: 'patient', required: true },
  assignedClinicIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Clinic' }],
  isActive: { type: Boolean, default: true },
  seedKey: { type: String, unique: true, sparse: true, select: false },
}, { timestamps: true });

userSchema.index({ role: 1, isActive: 1 });

export default mongoose.model('User', userSchema);
