import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import User from '../src/models/User.js';

const inputSchema = z.object({
  name: z.string().trim().min(2).max(80).default('QueueSaathi Administrator'),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(128),
});

async function run() {
  const parsed = inputSchema.safeParse({
    name: process.env.BOOTSTRAP_ADMIN_NAME || undefined,
    email: process.env.BOOTSTRAP_ADMIN_EMAIL,
    password: process.env.BOOTSTRAP_ADMIN_PASSWORD,
  });
  if (!parsed.success) {
    throw new Error('Set a valid BOOTSTRAP_ADMIN_EMAIL and a BOOTSTRAP_ADMIN_PASSWORD of at least 12 characters.');
  }

  await connectDatabase();
  if (await User.exists({ role: 'admin' })) {
    throw new Error('An administrator already exists. This bootstrap command only creates the first administrator.');
  }
  if (await User.exists({ email: parsed.data.email })) {
    throw new Error('That email already belongs to an account. Choose another email or manage the existing account.');
  }

  await User.create({
    name: parsed.data.name,
    email: parsed.data.email,
    passwordHash: await bcrypt.hash(parsed.data.password, 12),
    role: 'admin',
  });
  console.log(`Created the first QueueSaathi administrator: ${parsed.data.email}`);
}

run()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(disconnectDatabase);
