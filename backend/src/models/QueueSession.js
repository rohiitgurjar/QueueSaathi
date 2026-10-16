import mongoose from 'mongoose';

const queueSessionSchema = new mongoose.Schema({
  clinic: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic', required: true },
  sessionKey: { type: String, required: true },
  lastTokenNumber: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

queueSessionSchema.index({ clinic: 1, sessionKey: 1 }, { unique: true });

export default mongoose.model('QueueSession', queueSessionSchema);
