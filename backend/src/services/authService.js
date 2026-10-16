import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { config } from '../config/env.js';

const ACCESS_COOKIE = 'qs_access';
const CSRF_COOKIE = 'qs_csrf';
const SESSION_MAX_AGE = 12 * 60 * 60 * 1000;

export function cookieOptions(httpOnly = true) {
  return {
    httpOnly,
    secure: config.isProduction,
    sameSite: config.cookieSameSite,
    path: '/',
    maxAge: SESSION_MAX_AGE,
  };
}

export function clearSessionCookies(res) {
  const options = { ...cookieOptions(true), maxAge: undefined };
  res.clearCookie(ACCESS_COOKIE, options);
  res.clearCookie(CSRF_COOKIE, { ...cookieOptions(false), maxAge: undefined });
}

export function setCsrfCookie(res, token) {
  res.cookie(CSRF_COOKIE, token, cookieOptions(false));
}

function setAccessCookie(res, user) {
  const token = jwt.sign({ sub: String(user._id) }, config.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: '12h',
    issuer: 'queuesaathi-api',
    audience: 'queuesaathi-client',
  });
  res.cookie(ACCESS_COOKIE, token, cookieOptions(true));
}

export function publicUser(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    assignedClinics: user.role === 'staff'
      ? user.assignedClinicIds.map((clinic) => ({
        id: String(clinic._id ?? clinic),
        name: clinic.name,
        active: clinic.active,
      }))
      : [],
  };
}

export async function registerPatient(input, res) {
  const existing = await User.exists({ email: input.email });
  if (existing) throw new ApiError(409, 'EMAIL_IN_USE', 'An account with that email already exists.');

  const passwordHash = await bcrypt.hash(input.password, 12);
  let user;
  try {
    user = await User.create({
      name: input.name,
      email: input.email,
      passwordHash,
      role: 'patient', // Public registration can never assign privileged roles.
    });
  } catch (error) {
    if (error?.code === 11000) throw new ApiError(409, 'EMAIL_IN_USE', 'An account with that email already exists.');
    throw error;
  }
  setAccessCookie(res, user);
  return publicUser(user);
}

export async function login(input, res) {
  const user = await User.findOne({ email: input.email }).select('+passwordHash').populate('assignedClinicIds', 'name active');
  const validPassword = user ? await bcrypt.compare(input.password, user.passwordHash) : false;
  if (!user || !validPassword || !user.isActive) {
    throw new ApiError(401, 'LOGIN_FAILED', 'Email or password is incorrect.');
  }
  setAccessCookie(res, user);
  return publicUser(user);
}
