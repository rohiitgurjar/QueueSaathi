import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { config } from '../src/config/env.js';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import User from '../src/models/User.js';
import Clinic from '../src/models/Clinic.js';
import ClinicCategory from '../src/models/ClinicCategory.js';
import QueueSession from '../src/models/QueueSession.js';
import QueueToken from '../src/models/QueueToken.js';
import { currentSessionKey } from '../src/utils/session.js';

const categories = [
  { name: 'General care', slug: 'general-care' },
  { name: 'Diagnostics', slug: 'diagnostics' },
  { name: 'Dental', slug: 'dental' },
  { name: 'Eye care', slug: 'eye-care' },
  { name: 'Women’s health', slug: 'womens-health' },
];

const clinicRecords = [
  {
    key: 'asha-family-health', name: 'Asha Family Health Centre', category: 'General care',
    description: 'Example primary care for routine family consultations and follow-up visits.',
    address: 'Model Town Road, Phagwara, Punjab', openingHours: 'Mon–Sat, 9:00 AM–6:00 PM', averageServiceDurationMinutes: 8, queueSize: 3, firstCalled: true,
  },
  {
    key: 'northstar-diagnostics', name: 'Northstar Diagnostics & Imaging', category: 'Diagnostics',
    description: 'Example diagnostic services for common laboratory tests and imaging appointments.',
    address: 'GT Road, Phagwara, Punjab', openingHours: 'Mon–Sat, 7:30 AM–7:00 PM', averageServiceDurationMinutes: 12, queueSize: 3,
  },
  {
    key: 'sukh-dental-studio', name: 'Sukh Dental Studio', category: 'Dental',
    description: 'Example preventive and restorative dental care in a calm neighbourhood setting.',
    address: 'Hargobind Nagar, Phagwara, Punjab', openingHours: 'Mon–Sat, 10:00 AM–7:00 PM', averageServiceDurationMinutes: 20, queueSize: 2,
  },
  {
    key: 'clearview-eye-clinic', name: 'ClearView Eye Clinic', category: 'Eye care',
    description: 'Example vision checks and routine eye consultations for adults and children.',
    address: 'Near Bus Stand, Phagwara, Punjab', openingHours: 'Mon–Fri, 9:30 AM–5:30 PM', averageServiceDurationMinutes: 15, queueSize: 2,
  },
  {
    key: 'savera-womens-wellness', name: 'Savera Women’s Wellness', category: 'Women’s health',
    description: 'Example women’s health practice focused on respectful, preventive care.',
    address: 'Green Avenue, Phagwara, Punjab', openingHours: 'Mon–Sat, 10:00 AM–6:00 PM', averageServiceDurationMinutes: 18, queueSize: 2,
  },
];

function requireSeedCredentials() {
  const required = ['DEMO_ADMIN_EMAIL', 'DEMO_ADMIN_PASSWORD', 'DEMO_STAFF_EMAIL', 'DEMO_STAFF_PASSWORD'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Set ${missing.join(', ')} in backend/.env before seeding. The seed script intentionally has no built-in passwords.`);
  }
  for (const key of ['DEMO_ADMIN_PASSWORD', 'DEMO_STAFF_PASSWORD']) {
    if (process.env[key].length < 12) throw new Error(`${key} must be at least 12 characters.`);
  }
  if (config.isProduction) throw new Error('Demo seeding is disabled in production.');
}

async function ensureCategory(record) {
  const seedKey = `demo-category-${record.slug}`;
  let category = await ClinicCategory.findOne({ seedKey });
  if (!category) category = await ClinicCategory.create({ name: record.name, slug: record.slug, active: true, seedKey });
  else {
    category.name = record.name;
    category.slug = record.slug;
    category.active = true;
    await category.save();
  }
  return category;
}

async function ensureClinic(record, category) {
  const seedKey = `demo-clinic-${record.key}`;
  let clinic = await Clinic.findOne({ seedKey }).select('+seedKey');
  const values = {
    name: record.name,
    description: record.description,
    category: category._id,
    address: record.address,
    openingHours: record.openingHours,
    averageServiceDurationMinutes: record.averageServiceDurationMinutes,
    active: true,
    isDemo: true,
    seedKey,
  };
  if (!clinic) clinic = await Clinic.create(values);
  else {
    Object.assign(clinic, values);
    await clinic.save();
  }
  return clinic;
}

async function ensureSeedUser({ seedKey, name, email, password, role, assignedClinicIds = [] }) {
  let user = await User.findOne({ $or: [{ email }, { seedKey }] }).select('+seedKey');
  if (user && user.seedKey !== seedKey) {
    throw new Error(`Refusing to change the role of non-seed account ${email}. Choose a separate demo email.`);
  }
  const passwordHash = password
    ? await bcrypt.hash(password, 12)
    : await bcrypt.hash(randomBytes(32).toString('hex'), 12);
  if (!user) user = new User({ name, email, passwordHash, role, seedKey, assignedClinicIds, isActive: true });
  else Object.assign(user, { name, email, passwordHash, role, assignedClinicIds, isActive: true });
  await user.save();
  return user;
}

async function allocateNumber(clinicId, sessionKey) {
  const session = await QueueSession.findOneAndUpdate(
    { clinic: clinicId, sessionKey },
    { $inc: { lastTokenNumber: 1 } },
    { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
  );
  return session.lastTokenNumber;
}

async function ensureSampleTokens(clinic, queueSize, firstCalled, patients) {
  const sessionKey = currentSessionKey();
  for (let slot = 1; slot <= queueSize; slot += 1) {
    const seedKey = `demo-token-${clinic.seedKey}-${sessionKey}-${slot}`;
    if (await QueueToken.exists({ seedKey })) continue;
    const tokenNumber = await allocateNumber(clinic._id, sessionKey);
    await QueueToken.create({
      clinic: clinic._id,
      patient: patients[(slot - 1) % patients.length]._id,
      sessionKey,
      tokenNumber,
      status: firstCalled && slot === 1 ? 'CALLED' : 'WAITING',
      isActive: true,
      calledAt: firstCalled && slot === 1 ? new Date() : null,
      seedKey,
    });
  }
}

async function resetSeedData() {
  if (process.env.CONFIRM_RESET_DEMO_DATA !== 'YES') {
    throw new Error('To reset sample records, set CONFIRM_RESET_DEMO_DATA=YES and pass --reset.');
  }
  if (config.isProduction) throw new Error('Refusing to reset demo records in production.');
  const demoClinics = await Clinic.find({ seedKey: { $regex: /^demo-clinic-/ } }).select('_id');
  const clinicIds = demoClinics.map((clinic) => clinic._id);
  if (clinicIds.length) {
    await QueueToken.deleteMany({ clinic: { $in: clinicIds } });
    await QueueSession.deleteMany({ clinic: { $in: clinicIds } });
    await Clinic.deleteMany({ _id: { $in: clinicIds } });
  }
  await User.deleteMany({ seedKey: { $in: ['demo-admin', 'demo-staff', 'demo-patient-1', 'demo-patient-2', 'demo-patient-3'] } });
  const demoCategories = await ClinicCategory.find({ seedKey: { $regex: /^demo-category-/ } }).select('_id');
  for (const category of demoCategories) {
    if (!(await Clinic.exists({ category: category._id }))) await ClinicCategory.deleteOne({ _id: category._id });
  }
  console.log('Removed QueueSaathi sample clinics, sample queue sessions/tokens, and seeded demo accounts.');
}

async function run() {
  requireSeedCredentials();
  await connectDatabase();
  if (process.argv.includes('--reset')) await resetSeedData();

  const categoryDocs = new Map();
  for (const record of categories) categoryDocs.set(record.name, await ensureCategory(record));
  const clinicDocs = new Map();
  for (const record of clinicRecords) {
    clinicDocs.set(record.key, await ensureClinic(record, categoryDocs.get(record.category)));
  }

  await ensureSeedUser({
    seedKey: 'demo-admin', name: 'QueueSaathi Demo Admin', email: process.env.DEMO_ADMIN_EMAIL,
    password: process.env.DEMO_ADMIN_PASSWORD, role: 'admin',
  });
  const firstClinic = clinicDocs.get('asha-family-health');
  await ensureSeedUser({
    seedKey: 'demo-staff', name: 'QueueSaathi Demo Staff', email: process.env.DEMO_STAFF_EMAIL,
    password: process.env.DEMO_STAFF_PASSWORD, role: 'staff', assignedClinicIds: [firstClinic._id],
  });

  const patients = [];
  for (let index = 1; index <= 3; index += 1) {
    patients.push(await ensureSeedUser({
      seedKey: `demo-patient-${index}`,
      name: `Sample Patient ${index}`,
      email: `sample.patient.${index}@queuesaathi.test`,
      password: null,
      role: 'patient',
    }));
  }
  for (const record of clinicRecords) {
    await ensureSampleTokens(clinicDocs.get(record.key), record.queueSize, record.firstCalled ?? false, patients);
  }

  console.log(`Seeded ${clinicDocs.size} example clinics and ${categoryDocs.size} categories.`);
  console.log(`Demo admin: ${process.env.DEMO_ADMIN_EMAIL}`);
  console.log(`Demo staff: ${process.env.DEMO_STAFF_EMAIL} (assigned to Asha Family Health Centre)`);
  console.log('Use the passwords you set locally in backend/.env. Sample queue patients have no login credentials.');
}

run()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
    if (mongoose.connection.readyState === 0) process.exit();
  });
