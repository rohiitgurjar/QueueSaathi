import mongoose from 'mongoose';

const clinicCategorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  active: { type: Boolean, default: true },
  seedKey: { type: String, unique: true, sparse: true, select: false },
}, { timestamps: true });

clinicCategorySchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

export default mongoose.model('ClinicCategory', clinicCategorySchema);
