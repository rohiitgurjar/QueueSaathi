import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import User from '../src/models/User.js';
import Clinic from '../src/models/Clinic.js';
import ClinicCategory from '../src/models/ClinicCategory.js';
import QueueSession from '../src/models/QueueSession.js';
import QueueToken from '../src/models/QueueToken.js';

const app = createApp();
let mongoServer;
let category;
let clinic;
let otherClinic;
let passwordHash;

const models = [User, Clinic, ClinicCategory, QueueSession, QueueToken];

async function csrfToken(agent) {
  const response = await agent.get('/api/auth/csrf').expect(200);
  return response.body.data.csrfToken;
}

async function postWithCsrf(agent, path, body = {}, expectedStatus) {
  const token = await csrfToken(agent);
  const action = agent.post(path).set('X-CSRF-Token', token).send(body);
  return expectedStatus ? action.expect(expectedStatus) : action;
}

async function patchWithCsrf(agent, path, body = {}, expectedStatus) {
  const token = await csrfToken(agent);
  const action = agent.patch(path).set('X-CSRF-Token', token).send(body);
  return expectedStatus ? action.expect(expectedStatus) : action;
}

async function deleteWithCsrf(agent, path, expectedStatus) {
  const token = await csrfToken(agent);
  const action = agent.delete(path).set('X-CSRF-Token', token);
  return expectedStatus ? action.expect(expectedStatus) : action;
}

async function createPatient(email, name = 'Test Patient') {
  const user = await User.create({ name, email, passwordHash, role: 'patient' });
  const agent = request.agent(app);
  await csrfToken(agent);
  await postWithCsrf(agent, '/api/auth/login', { email, password: 'PatientPass123' }, 200);
  return { user, agent };
}

async function makeToken(agent, clinicId = clinic._id) {
  return postWithCsrf(agent, `/api/clinics/${clinicId}/queue`, {}, 201);
}

async function makeAdmin() {
  const user = await User.create({ name: 'Queue Admin', email: 'admin@example.test', passwordHash, role: 'admin' });
  const agent = request.agent(app);
  await csrfToken(agent);
  await postWithCsrf(agent, '/api/auth/login', { email: user.email, password: 'PatientPass123' }, 200);
  return { user, agent };
}

async function makeStaff(assignedClinicIds = [clinic._id]) {
  const user = await User.create({
    name: 'Clinic Staff', email: `staff-${new mongoose.Types.ObjectId()}@example.test`,
    passwordHash, role: 'staff', assignedClinicIds,
  });
  const agent = request.agent(app);
  await csrfToken(agent);
  await postWithCsrf(agent, '/api/auth/login', { email: user.email, password: 'PatientPass123' }, 200);
  return { user, agent };
}

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create({ binary: { version: '7.0.14' } });
  await connectDatabase(mongoServer.getUri());
  passwordHash = await bcrypt.hash('PatientPass123', 4);
});

afterAll(async () => {
  await disconnectDatabase();
  await mongoServer?.stop();
});

beforeEach(async () => {
  await Promise.all(models.map((model) => model.deleteMany({})));
  category = await ClinicCategory.create({ name: 'General care', slug: 'general-care' });
  clinic = await Clinic.create({
    name: 'Asha Test Clinic', description: 'A sample clinic for API integration tests.',
    category: category._id, address: '1 Test Road, Demo City', openingHours: 'Mon–Fri, 9 AM–5 PM',
    averageServiceDurationMinutes: 10, active: true,
  });
  otherClinic = await Clinic.create({
    name: 'Other Test Clinic', description: 'A second clinic for access-control tests.',
    category: category._id, address: '2 Test Road, Demo City', openingHours: 'Mon–Fri, 9 AM–5 PM',
    averageServiceDurationMinutes: 12, active: true,
  });
});

describe('authentication and authorization', () => {
  it('registers a patient and never accepts a public role assignment', async () => {
    const agent = request.agent(app);
    const token = await csrfToken(agent);
    const rejectedRole = await agent.post('/api/auth/register')
      .set('X-CSRF-Token', token)
      .send({ name: 'Public Admin', email: 'public@example.test', password: 'SecurePass123', role: 'admin' });
    expect(rejectedRole.status).toBe(400);

    const created = await postWithCsrf(agent, '/api/auth/register', {
      name: 'New Patient', email: 'NEW.Patient@example.test', password: 'SecurePass123',
    }, 201);
    expect(created.body.data.user.role).toBe('patient');
    expect(created.body.data.user.email).toBe('new.patient@example.test');
    const current = await agent.get('/api/auth/me').expect(200);
    expect(current.body.data.user.role).toBe('patient');
  });

  it('allows a valid login and returns a generic error for a bad password', async () => {
    await User.create({ name: 'Login Patient', email: 'login@example.test', passwordHash, role: 'patient' });
    const agent = request.agent(app);
    const invalid = await postWithCsrf(agent, '/api/auth/login', { email: 'login@example.test', password: 'wrong-password' });
    expect(invalid.status).toBe(401);
    expect(invalid.body.error.message).toMatch(/incorrect/i);

    const valid = await postWithCsrf(agent, '/api/auth/login', { email: 'LOGIN@example.test', password: 'PatientPass123' }, 200);
    expect(valid.body.data.user.role).toBe('patient');
    await agent.get('/api/auth/me').expect(200);
  });

  it('blocks protected routes without an authenticated cookie', async () => {
    await request(app).get('/api/queue/my-active').expect(401);
  });

  it('keeps clinic administration behind the administrator role', async () => {
    const patient = await createPatient('not-admin@example.test');
    const body = {
      name: 'New Clinic', description: 'A clinic created for an authorization test.', categoryId: String(category._id),
      address: '3 Test Road, Demo City', openingHours: 'Mon–Fri, 9 AM–5 PM', averageServiceDurationMinutes: 10,
    };
    const denied = await postWithCsrf(patient.agent, '/api/clinics', body);
    expect(denied.status).toBe(403);
    expect(await Clinic.countDocuments()).toBe(2);
  });

  it('lets an administrator manage clinics, categories, and staff assignments', async () => {
    const admin = await makeAdmin();
    const createdCategory = await postWithCsrf(admin.agent, '/api/clinics/categories', { name: 'Wellness' }, 201);
    const newClinic = await postWithCsrf(admin.agent, '/api/clinics', {
      name: 'Wellness Test Centre', description: 'A test clinic used by the administrator API scenario.',
      categoryId: createdCategory.body.data.category._id,
      address: '10 Example Road, Demo City', openingHours: 'Mon–Fri, 9 AM–5 PM',
      averageServiceDurationMinutes: 12,
    }, 201);
    const clinicId = newClinic.body.data.clinic._id;
    expect(newClinic.body.data.clinic.active).toBe(true);

    const staffCreated = await postWithCsrf(admin.agent, '/api/admin/staff', {
      name: 'Assigned Staff', email: 'assigned-staff@example.test', password: 'AStaffPassword123', clinicIds: [clinicId],
    }, 201);
    const staffId = staffCreated.body.data.staff.id;
    await patchWithCsrf(admin.agent, `/api/admin/staff/${staffId}/clinics`, { clinicIds: [clinic._id] }, 200);
    const staffList = await admin.agent.get('/api/admin/staff').expect(200);
    expect(staffList.body.data.staff.find((member) => member.id === staffId).clinics[0].id).toBe(String(clinic._id));

    const stats = await admin.agent.get('/api/admin/stats').expect(200);
    expect(stats.body.data.clinics.total).toBe(3);
    await patchWithCsrf(admin.agent, `/api/clinics/${clinicId}`, { active: false }, 200);
    const publicList = await request(app).get('/api/clinics').expect(200);
    expect(publicList.body.data.clinics.some((item) => item._id === clinicId)).toBe(false);
    const adminList = await admin.agent.get('/api/clinics?includeInactive=true').expect(200);
    expect(adminList.body.data.clinics.some((item) => item._id === clinicId && !item.active)).toBe(true);
    await deleteWithCsrf(admin.agent, `/api/clinics/categories/${createdCategory.body.data.category._id}`, 409);
  });

  it('prevents a patient from reading another patient’s token', async () => {
    const first = await createPatient('first@example.test', 'First Patient');
    const second = await createPatient('second@example.test', 'Second Patient');
    const joined = await makeToken(first.agent);
    const tokenId = joined.body.data.token._id;
    await second.agent.get(`/api/queue/${tokenId}`).expect(403);
    const otherPatientList = await second.agent.get('/api/queue/my-active').expect(200);
    expect(otherPatientList.body.data.tokens).toHaveLength(0);
  });

  it('prevents staff from managing a clinic they are not assigned to', async () => {
    const { agent } = await makeStaff([clinic._id]);
    await agent.get(`/api/clinics/${otherClinic._id}/queue`).expect(403);
    await postWithCsrf(agent, `/api/clinics/${otherClinic._id}/queue/call-next`, {}, 403);
  });
});

describe('queue correctness and transitions', () => {
  it('rejects a duplicate active token, then permits a new token after cancellation', async () => {
    const patient = await createPatient('repeat@example.test');
    const first = await makeToken(patient.agent);
    const duplicate = await postWithCsrf(patient.agent, `/api/clinics/${clinic._id}/queue`, {});
    expect(duplicate.status).toBe(409);
    await postWithCsrf(patient.agent, `/api/queue/${first.body.data.token._id}/cancel`, {}, 200);
    const next = await makeToken(patient.agent);
    expect(next.body.data.token.tokenNumber).toBe(2);
  });

  it('uses the database uniqueness rule for simultaneous duplicate joins', async () => {
    const patient = await createPatient('join-race@example.test', 'Join Race');
    const secondSession = request.agent(app);
    await csrfToken(secondSession);
    await postWithCsrf(secondSession, '/api/auth/login', { email: 'join-race@example.test', password: 'PatientPass123' }, 200);

    const results = await Promise.all([
      postWithCsrf(patient.agent, `/api/clinics/${clinic._id}/queue`, {}),
      postWithCsrf(secondSession, `/api/clinics/${clinic._id}/queue`, {}),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    expect(await QueueToken.countDocuments({ clinic: clinic._id, patient: patient.user._id, isActive: true })).toBe(1);
  });

  it('allocates distinct token numbers for simultaneous joins', async () => {
    const first = await createPatient('parallel-one@example.test', 'Parallel One');
    const second = await createPatient('parallel-two@example.test', 'Parallel Two');
    const [one, two] = await Promise.all([makeToken(first.agent), makeToken(second.agent)]);
    expect(one.status).toBe(201);
    expect(two.status).toBe(201);
    const numbers = [one.body.data.token.tokenNumber, two.body.data.token.tokenNumber].sort((a, b) => a - b);
    expect(numbers).toEqual([1, 2]);
  });

  it('allows only one token to be called during concurrent staff requests', async () => {
    const first = await createPatient('call-race-one@example.test', 'Call Race One');
    const second = await createPatient('call-race-two@example.test', 'Call Race Two');
    await makeToken(first.agent);
    await makeToken(second.agent);
    const staffOne = await makeStaff();
    const staffTwo = await makeStaff();

    const results = await Promise.all([
      postWithCsrf(staffOne.agent, `/api/clinics/${clinic._id}/queue/call-next`, {}),
      postWithCsrf(staffTwo.agent, `/api/clinics/${clinic._id}/queue/call-next`, {}),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    expect(await QueueToken.countDocuments({ clinic: clinic._id, status: 'CALLED' })).toBe(1);
    expect(await QueueToken.countDocuments({ clinic: clinic._id, status: 'WAITING' })).toBe(1);
  });

  it('calls the lowest waiting token, blocks a second call, then serves correctly', async () => {
    const first = await createPatient('queue-one@example.test', 'Queue One');
    const second = await createPatient('queue-two@example.test', 'Queue Two');
    const firstToken = await makeToken(first.agent);
    const secondToken = await makeToken(second.agent);
    const staff = await makeStaff();

    const called = await postWithCsrf(staff.agent, `/api/clinics/${clinic._id}/queue/call-next`, {}, 200);
    expect(called.body.data.token.tokenNumber).toBe(firstToken.body.data.token.tokenNumber);
    expect(called.body.data.token.status).toBe('CALLED');
    await postWithCsrf(staff.agent, `/api/clinics/${clinic._id}/queue/call-next`, {}, 409);
    await postWithCsrf(staff.agent, `/api/queue/${called.body.data.token._id}/serve`, {}, 200);
    const next = await postWithCsrf(staff.agent, `/api/clinics/${clinic._id}/queue/call-next`, {}, 200);
    expect(next.body.data.token._id).toBe(secondToken.body.data.token._id);
  });

  it('rejects invalid transitions and allows cancellation/skip with queue state updates', async () => {
    const first = await createPatient('transition-one@example.test', 'Transition One');
    const second = await createPatient('transition-two@example.test', 'Transition Two');
    const firstToken = await makeToken(first.agent);
    const secondToken = await makeToken(second.agent);
    const staff = await makeStaff();

    await postWithCsrf(staff.agent, `/api/queue/${firstToken.body.data.token._id}/serve`, {}, 409);
    await postWithCsrf(first.agent, `/api/queue/${firstToken.body.data.token._id}/cancel`, {}, 200);
    await postWithCsrf(first.agent, `/api/queue/${firstToken.body.data.token._id}/cancel`, {}, 409);

    const skipped = await postWithCsrf(staff.agent, `/api/queue/${secondToken.body.data.token._id}/skip`, { reason: 'Patient did not respond' }, 200);
    expect(skipped.body.data.token.status).toBe('SKIPPED');
    expect(skipped.body.data.token.isActive).toBe(false);

    const status = await request(app).get(`/api/clinics/${clinic._id}/queue/status`).expect(200);
    expect(status.body.data.queue.waitingCount).toBe(0);
  });

  it('requires a skip reason and exposes a labelled queue estimate', async () => {
    const patient = await createPatient('estimate@example.test');
    const first = await makeToken(patient.agent);
    const staff = await makeStaff();
    await postWithCsrf(staff.agent, `/api/queue/${first.body.data.token._id}/skip`, {}, 400);
    const status = await request(app).get(`/api/clinics/${clinic._id}/queue/status`).expect(200);
    expect(status.body.data.queue.isEstimate).toBe(true);
    expect(status.body.data.queue.waitingCount).toBe(1);
  });
});
