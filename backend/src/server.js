import { createServer } from 'node:http';
import { config } from './config/env.js';
import { connectDatabase } from './config/database.js';
import { createApp } from './app.js';

const server = createServer(createApp());

try {
  await connectDatabase();
  server.listen(config.port, '0.0.0.0', () => {
    console.log(`QueueSaathi API listening on http://0.0.0.0:${config.port}`);
  });
} catch (error) {
  console.error('Could not start QueueSaathi API. Check MongoDB and environment configuration.');
  if (!config.isProduction) console.error(error.message);
  process.exit(1);
}

async function shutdown(signal) {
  console.log(`${signal} received; shutting down.`);
  server.close(async () => {
    const mongoose = await import('mongoose');
    await mongoose.default.disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
