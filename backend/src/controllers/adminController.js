import bcrypt from 'bcryptjs';
import Clinic from '../models/Clinic.js';
import ClinicCategory from '../models/ClinicCategory.js';
import QueueToken from '../models/QueueToken.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { currentSessionKey } from '../utils/session.js';

export async function getStats(req, res) {
  const sessionKey = currentSessionKey();
  const [clinicCount, activeClinicCount, userCounts, tokenCounts] = await Promise.all([
    Clinic.countDocuments(),
    Clinic.countDocuments({ active: true }),
    User.aggregate([{ $match: { isActive: true } }, { $group: { _id: '$role', count: { $sum: 1 } } }]),
    QueueToken.aggregate([
      { $match: { sessionKey } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ]);
  const users = Object.fromEntries(userCounts.map((item) => [item._id, item.count]));
  const tokensToday = Object.fromEntries(tokenCounts.map((item) => [item._id, item.count]));
  res.json({
    data: {
      clinics: { total: clinicCount, active: activeClinicCount },
      users: { patients: users.patient ?? 0, staff: users.staff ?? 0, admins: users.admin ?? 0 },
      queueToday: {
        waiting: tokensToday.WAITING ?? 0,
        called: tokensToday.CALLED ?? 0,
        served: tokensToday.SERVED ?? 0,
        skipped: tokensToday.SKIPPED ?? 0,
        cancelled: tokensToday.CANCELLED ?? 0,
      },
      sessionKey,
    },
  });
}

export async function listStaff(req, res) {
  const users = await User.find({ role: 'staff' })
    .select('name email role assignedClinicIds isActive createdAt')
    .populate('assignedClinicIds', 'name active')
    .sort({ name: 1 })
    .lean();
  res.json({ data: { staff: users.map((user) => ({
    id: String(user._id), name: user.name, email: user.email,
    active: user.isActive,
    clinics: user.assignedClinicIds.map((clinic) => ({ id: String(clinic._id), name: clinic.name, active: clinic.active })),
  })) } });
}

async function validateClinicIds(clinicIds) {
  const uniqueIds = [...new Set(clinicIds.map(String))];
  const clinics = await Clinic.find({ _id: { $in: uniqueIds }, active: true }).select('_id');
  if (clinics.length !== uniqueIds.length) throw new ApiError(400, 'CLINIC_INVALID', 'Choose only active clinics.');
  return clinics.map((clinic) => clinic._id);
}

export async function createStaff(req, res) {
  const input = req.validatedBody;
  const existing = await User.exists({ email: input.email });
  if (existing) throw new ApiError(409, 'EMAIL_IN_USE', 'An account with that email already exists.');
  const clinicIds = await validateClinicIds(input.clinicIds);
  const passwordHash = await bcrypt.hash(input.password, 12);
  let staff;
  try {
    staff = await User.create({ name: input.name, email: input.email, passwordHash, role: 'staff', assignedClinicIds: clinicIds });
  } catch (error) {
    if (error?.code === 11000) throw new ApiError(409, 'EMAIL_IN_USE', 'An account with that email already exists.');
    throw error;
  }
  res.status(201).json({ data: { staff: { id: String(staff._id), name: staff.name, email: staff.email, clinics: clinicIds.map(String) } }, message: 'Staff account created.' });
}

export async function assignStaffClinics(req, res) {
  const clinicIds = await validateClinicIds(req.validatedBody.clinicIds);
  const staff = await User.findOneAndUpdate(
    { _id: req.params.staffId, role: 'staff' },
    { $set: { assignedClinicIds: clinicIds } },
    { returnDocument: 'after' },
  ).populate('assignedClinicIds', 'name active');
  if (!staff) throw new ApiError(404, 'STAFF_NOT_FOUND', 'Staff member not found.');
  res.json({ data: { staff: {
    id: String(staff._id), name: staff.name, email: staff.email,
    clinics: staff.assignedClinicIds.map((clinic) => ({ id: String(clinic._id), name: clinic.name, active: clinic.active })),
  } }, message: 'Clinic assignments updated.' });
}

export async function deactivateStaff(req, res) {
  const staff = await User.findOneAndUpdate({ _id: req.params.staffId, role: 'staff' }, { $set: { isActive: false } }, { returnDocument: 'after' });
  if (!staff) throw new ApiError(404, 'STAFF_NOT_FOUND', 'Staff member not found.');
  res.json({ data: { deactivated: true }, message: 'Staff account deactivated.' });
}
