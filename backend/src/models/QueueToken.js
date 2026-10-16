import mongoose from 'mongoose';

const queueTokenSchema = new mongoose.Schema({
  clinic: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic', required: true },
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sessionKey: { type: String, required: true },
  tokenNumber: { type: Number, required: true, min: 1 },
  status: { type: String, enum: ['WAITING', 'CALLED', 'SERVED', 'SKIPPED', 'CANCELLED'], default: 'WAITING', required: true },
  isActive: { type: Boolean, default: true },
  calledAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  reason: { type: String, trim: true, maxlength: 240, default: '' },
  seedKey: { type: String, unique: true, sparse: true, select: false },
}, { timestamps: true });

// Enforces token-number uniqueness within one clinic's daily session.
queueTokenSchema.index({ clinic: 1, sessionKey: 1, tokenNumber: 1 }, { unique: true });
// One active (waiting or called) token per patient, clinic, and session.
queueTokenSchema.index(
  { clinic: 1, sessionKey: 1, patient: 1 },
  { unique: true, partialFilterExpression: { isActive: true } },
);
// At most one currently called token for a clinic session; this closes the concurrent call-next race.
queueTokenSchema.index(
  { clinic: 1, sessionKey: 1 },
  { unique: true, partialFilterExpression: { status: 'CALLED' } },
);
queueTokenSchema.index({ clinic: 1, sessionKey: 1, status: 1, tokenNumber: 1 });
queueTokenSchema.index({ patient: 1, createdAt: -1 });

export default mongoose.model('QueueToken', queueTokenSchema);
