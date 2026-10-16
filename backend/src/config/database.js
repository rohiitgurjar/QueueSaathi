import mongoose from 'mongoose';
import { config } from './env.js';
import User from '../models/User.js';
import Clinic from '../models/Clinic.js';
import ClinicCategory from '../models/ClinicCategory.js';
import QueueSession from '../models/QueueSession.js';
import QueueToken from '../models/QueueToken.js';

export async function connectDatabase(uri = config.mongoUri) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });

  // Queue correctness relies on unique indexes. Build/verify them before serving requests.
  await Promise.all([
    User.createIndexes(),
    Clinic.createIndexes(),
    ClinicCategory.createIndexes(),
    QueueSession.createIndexes(),
    QueueToken.createIndexes(),
  ]);
  return mongoose.connection;
}

export async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}
