import mongoose from 'mongoose';

const clinicSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
  description: { type: String, required: true, trim: true, maxlength: 1200 },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'ClinicCategory', required: true, index: true },
  address: { type: String, required: true, trim: true, maxlength: 240 },
  openingHours: { type: String, required: true, trim: true, maxlength: 120 },
  averageServiceDurationMinutes: { type: Number, required: true, min: 1, max: 240 },
  active: { type: Boolean, default: true, index: true },
  isDemo: { type: Boolean, default: false },
  seedKey: { type: String, unique: true, sparse: true, select: false },
}, { timestamps: true });

clinicSchema.index({ active: 1, name: 1 });

export default mongoose.model('Clinic', clinicSchema);
