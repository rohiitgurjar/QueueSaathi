import jwt from 'jsonwebtoken';
import { timingSafeEqual } from 'node:crypto';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { config } from '../config/env.js';

export async function requireAuth(req, res, next) {
  const token = req.cookies?.qs_access;
  if (!token) return next(new ApiError(401, 'AUTH_REQUIRED', 'Please log in to continue.'));

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'], issuer: 'queuesaathi-api', audience: 'queuesaathi-client' });
  } catch {
    return next(new ApiError(401, 'AUTH_INVALID', 'Your session has expired. Please log in again.'));
  }

  const user = await User.findById(payload.sub).populate('assignedClinicIds', 'name active');
  if (!user || !user.isActive) return next(new ApiError(401, 'AUTH_INVALID', 'Your session is no longer valid.'));
  req.user = user;
  return next();
}

export async function optionalAuth(req, res, next) {
  const token = req.cookies?.qs_access;
  if (!token) return next();
  try {
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'], issuer: 'queuesaathi-api', audience: 'queuesaathi-client' });
    const user = await User.findById(payload.sub).populate('assignedClinicIds', 'name active');
    if (user?.isActive) req.user = user;
  } catch {
    // Public browsing remains available if an expired cookie is present.
  }
  return next();
}

export function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new ApiError(403, 'FORBIDDEN', 'You do not have permission to perform this action.'));
    }
    return next();
  };
}

export function assertClinicAccess(user, clinicId) {
  if (user.role === 'admin') return;
  const hasAccess = user.role === 'staff' && user.assignedClinicIds.some((clinic) => {
    const id = clinic?._id ?? clinic;
    return String(id) === String(clinicId);
  });
  if (!hasAccess) throw new ApiError(403, 'CLINIC_FORBIDDEN', 'You are not assigned to manage this clinic.');
}

export function csrfProtection(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const cookieToken = req.cookies?.qs_csrf;
  const headerToken = req.get('x-csrf-token');
  if (!cookieToken || !headerToken || cookieToken.length > 256 || headerToken.length > 256) {
    return next(new ApiError(403, 'CSRF_INVALID', 'Security check failed. Refresh the page and try again.'));
  }
  const cookieBuffer = Buffer.from(cookieToken);
  const headerBuffer = Buffer.from(headerToken);
  if (cookieBuffer.length !== headerBuffer.length || !cryptoSafeEqual(cookieBuffer, headerBuffer)) {
    return next(new ApiError(403, 'CSRF_INVALID', 'Security check failed. Refresh the page and try again.'));
  }
  return next();
}

function cryptoSafeEqual(first, second) {
  return timingSafeEqual(first, second);
}
