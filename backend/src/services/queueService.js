import Clinic from '../models/Clinic.js';
import QueueSession from '../models/QueueSession.js';
import QueueToken from '../models/QueueToken.js';
import ApiError from '../utils/ApiError.js';
import { assertClinicAccess } from '../middleware/authenticate.js';
import { currentSessionKey } from '../utils/session.js';

async function allocateNextNumber(clinicId, sessionKey) {
  try {
    const session = await QueueSession.findOneAndUpdate(
      { clinic: clinicId, sessionKey },
      { $inc: { lastTokenNumber: 1 } },
      { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
    );
    return session.lastTokenNumber;
  } catch (error) {
    // Two first-ever joins can race to upsert the same unique session. Retry against the winner.
    if (error?.code !== 11000) throw error;
    const session = await QueueSession.findOneAndUpdate(
      { clinic: clinicId, sessionKey },
      { $inc: { lastTokenNumber: 1 } },
      { returnDocument: 'after' },
    );
    if (!session) throw error;
    return session.lastTokenNumber;
  }
}

async function getQueuePosition(token, averageServiceDurationMinutes) {
  if (token.status !== 'WAITING' && token.status !== 'CALLED') {
    return { queuePosition: null, peopleAhead: null, estimatedWaitMinutes: null };
  }
  if (token.status === 'CALLED') {
    return { queuePosition: 0, peopleAhead: 0, estimatedWaitMinutes: 0 };
  }
  const [waitingAhead, currentlyCalled] = await Promise.all([
    QueueToken.countDocuments({
      clinic: token.clinic,
      sessionKey: token.sessionKey,
      status: 'WAITING',
      tokenNumber: { $lt: token.tokenNumber },
    }),
    QueueToken.countDocuments({ clinic: token.clinic, sessionKey: token.sessionKey, status: 'CALLED' }),
  ]);
  const peopleAhead = waitingAhead + currentlyCalled;
  return {
    queuePosition: peopleAhead + 1,
    peopleAhead,
    estimatedWaitMinutes: peopleAhead * averageServiceDurationMinutes,
  };
}

async function tokenWithClinic(token) {
  return QueueToken.findById(token._id ?? token)
    .populate({ path: 'clinic', select: 'name address averageServiceDurationMinutes isDemo category', populate: { path: 'category', select: 'name slug' } })
    .populate('patient', 'name')
    .lean();
}

async function enrichToken(token) {
  const clinicId = token.clinic?._id ?? token.clinic;
  const clinic = token.clinic && typeof token.clinic === 'object'
    ? token.clinic
    : await Clinic.findById(clinicId).select('averageServiceDurationMinutes').lean();
  const queue = await getQueuePosition({ ...token, clinic: clinicId }, clinic.averageServiceDurationMinutes);
  return {
    ...token,
    clinic: token.clinic && typeof token.clinic === 'object'
      ? { ...token.clinic, id: String(clinicId) }
      : String(clinicId),
    patient: token.patient && typeof token.patient === 'object'
      ? { id: String(token.patient._id), name: token.patient.name }
      : String(token.patient),
    ...queue,
    isEstimate: true,
  };
}

export async function joinQueue(clinicId, patientId) {
  const clinic = await Clinic.findOne({ _id: clinicId, active: true });
  if (!clinic) throw new ApiError(404, 'CLINIC_NOT_FOUND', 'This clinic is unavailable.');
  const sessionKey = currentSessionKey();
  const existing = await QueueToken.exists({ clinic: clinicId, sessionKey, patient: patientId, isActive: true });
  if (existing) throw new ApiError(409, 'ACTIVE_TOKEN_EXISTS', 'You already have an active token for this clinic today.');

  const tokenNumber = await allocateNextNumber(clinicId, sessionKey);
  try {
    const token = await QueueToken.create({
      clinic: clinicId,
      patient: patientId,
      sessionKey,
      tokenNumber,
      status: 'WAITING',
      isActive: true,
    });
    return enrichToken(await tokenWithClinic(token));
  } catch (error) {
    // The partial unique index is the final guard when two joins race for one patient.
    if (error?.code === 11000) {
      throw new ApiError(409, 'ACTIVE_TOKEN_EXISTS', 'You already have an active token for this clinic today.');
    }
    throw error;
  }
}

export async function listMyActiveTokens(patientId) {
  const tokens = await QueueToken.find({ patient: patientId, isActive: true })
    .sort({ createdAt: -1 })
    .populate({ path: 'clinic', select: 'name address averageServiceDurationMinutes isDemo category', populate: { path: 'category', select: 'name slug' } })
    .populate('patient', 'name')
    .lean();
  return Promise.all(tokens.map(enrichToken));
}

export async function listMyHistory(patientId) {
  const tokens = await QueueToken.find({ patient: patientId })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate({ path: 'clinic', select: 'name address averageServiceDurationMinutes isDemo category', populate: { path: 'category', select: 'name slug' } })
    .populate('patient', 'name')
    .lean();
  return Promise.all(tokens.map(enrichToken));
}

export async function getPublicQueueStatus(clinicId) {
  const clinic = await Clinic.findOne({ _id: clinicId, active: true }).select('averageServiceDurationMinutes isDemo');
  if (!clinic) throw new ApiError(404, 'CLINIC_NOT_FOUND', 'Clinic not found.');
  const sessionKey = currentSessionKey();
  const [waitingCount, currentlyServing] = await Promise.all([
    QueueToken.countDocuments({ clinic: clinicId, sessionKey, status: 'WAITING' }),
    QueueToken.findOne({ clinic: clinicId, sessionKey, status: 'CALLED' }).select('tokenNumber calledAt').lean(),
  ]);
  return {
    sessionKey,
    waitingCount,
    currentlyServing: currentlyServing ? { tokenNumber: currentlyServing.tokenNumber, calledAt: currentlyServing.calledAt } : null,
    averageServiceDurationMinutes: clinic.averageServiceDurationMinutes,
    estimatedWaitMinutes: (waitingCount + (currentlyServing ? 1 : 0)) * clinic.averageServiceDurationMinutes,
    isEstimate: true,
    isDemo: clinic.isDemo,
  };
}

export async function getStaffQueue(clinicId, actor) {
  assertClinicAccess(actor, clinicId);
  const clinic = await Clinic.findById(clinicId).select('name active');
  if (!clinic) throw new ApiError(404, 'CLINIC_NOT_FOUND', 'Clinic not found.');
  const sessionKey = currentSessionKey();
  const [tokens, grouped] = await Promise.all([
    QueueToken.find({ clinic: clinicId, sessionKey })
      .sort({ tokenNumber: 1 })
      .limit(150)
      .populate('patient', 'name')
      .lean(),
    QueueToken.aggregate([
      { $match: { clinic: clinic._id, sessionKey } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ]);
  const counts = Object.fromEntries(grouped.map(({ _id, count }) => [_id, count]));
  return {
    clinic: { id: String(clinic._id), name: clinic.name },
    sessionKey,
    statistics: {
      waiting: counts.WAITING ?? 0,
      called: counts.CALLED ?? 0,
      served: counts.SERVED ?? 0,
      skipped: counts.SKIPPED ?? 0,
      cancelled: counts.CANCELLED ?? 0,
    },
    tokens: tokens.map((token) => ({
      ...token,
      patient: token.patient ? { id: String(token.patient._id), name: token.patient.name } : null,
    })),
  };
}

export async function callNextToken(clinicId, actor) {
  assertClinicAccess(actor, clinicId);
  const clinic = await Clinic.findOne({ _id: clinicId, active: true });
  if (!clinic) throw new ApiError(404, 'CLINIC_NOT_FOUND', 'This clinic is unavailable.');
  const sessionKey = currentSessionKey();
  const current = await QueueToken.findOne({ clinic: clinicId, sessionKey, status: 'CALLED' }).select('_id').lean();
  if (current) throw new ApiError(409, 'TOKEN_ALREADY_CALLED', 'Serve or skip the current token before calling another.');

  let token;
  try {
    token = await QueueToken.findOneAndUpdate(
      { clinic: clinicId, sessionKey, status: 'WAITING' },
      { $set: { status: 'CALLED', calledAt: new Date() } },
      { returnDocument: 'after', sort: { tokenNumber: 1 }, runValidators: true },
    );
  } catch (error) {
    if (error?.code === 11000) {
      throw new ApiError(409, 'TOKEN_ALREADY_CALLED', 'Another staff action has already called a token. Refresh the queue.');
    }
    throw error;
  }
  if (!token) {
    const racedCurrent = await QueueToken.exists({ clinic: clinicId, sessionKey, status: 'CALLED' });
    if (racedCurrent) throw new ApiError(409, 'TOKEN_ALREADY_CALLED', 'Another staff action has already called a token. Refresh the queue.');
    return null;
  }
  return enrichToken(await tokenWithClinic(token));
}

async function findAuthorizedToken(tokenId, actor) {
  const token = await QueueToken.findById(tokenId).lean();
  if (!token) throw new ApiError(404, 'TOKEN_NOT_FOUND', 'Queue token not found.');
  if (actor.role === 'patient') {
    if (String(token.patient) !== String(actor._id)) throw new ApiError(403, 'TOKEN_FORBIDDEN', 'You can only access your own queue tokens.');
  } else {
    assertClinicAccess(actor, token.clinic);
  }
  return token;
}

export async function getTokenForActor(tokenId, actor) {
  const token = await findAuthorizedToken(tokenId, actor);
  return enrichToken(await tokenWithClinic(token));
}

export async function serveToken(tokenId, actor) {
  const token = await findAuthorizedToken(tokenId, actor);
  if (token.status !== 'CALLED') throw new ApiError(409, 'INVALID_TOKEN_STATE', 'Only a called token can be marked as served.');
  const updated = await QueueToken.findOneAndUpdate(
    { _id: tokenId, status: 'CALLED' },
    { $set: { status: 'SERVED', isActive: false, completedAt: new Date() } },
    { returnDocument: 'after' },
  );
  if (!updated) throw new ApiError(409, 'INVALID_TOKEN_STATE', 'This token changed state. Refresh the queue.');
  return enrichToken(await tokenWithClinic(updated));
}

export async function skipToken(tokenId, reason, actor) {
  const token = await findAuthorizedToken(tokenId, actor);
  if (!['WAITING', 'CALLED'].includes(token.status)) {
    throw new ApiError(409, 'INVALID_TOKEN_STATE', 'Only a waiting or called token can be skipped.');
  }
  const updated = await QueueToken.findOneAndUpdate(
    { _id: tokenId, status: { $in: ['WAITING', 'CALLED'] } },
    { $set: { status: 'SKIPPED', isActive: false, completedAt: new Date(), reason } },
    { returnDocument: 'after' },
  );
  if (!updated) throw new ApiError(409, 'INVALID_TOKEN_STATE', 'This token changed state. Refresh the queue.');
  return enrichToken(await tokenWithClinic(updated));
}

export async function cancelToken(tokenId, reason = '', actor) {
  const token = await findAuthorizedToken(tokenId, actor);
  const allowed = actor.role === 'patient' ? ['WAITING'] : ['WAITING', 'CALLED'];
  if (!allowed.includes(token.status)) {
    throw new ApiError(409, 'INVALID_TOKEN_STATE', actor.role === 'patient'
      ? 'Patients can cancel a token only while it is waiting.'
      : 'Only a waiting or called token can be cancelled.');
  }
  if (actor.role !== 'patient' && !reason) {
    throw new ApiError(400, 'REASON_REQUIRED', 'Staff must provide a cancellation reason.');
  }
  const updated = await QueueToken.findOneAndUpdate(
    { _id: tokenId, status: { $in: allowed }, ...(actor.role === 'patient' ? { patient: actor._id } : {}) },
    { $set: { status: 'CANCELLED', isActive: false, completedAt: new Date(), reason } },
    { returnDocument: 'after' },
  );
  if (!updated) throw new ApiError(409, 'INVALID_TOKEN_STATE', 'This token changed state. Refresh the queue.');
  return enrichToken(await tokenWithClinic(updated));
}
