import { randomBytes } from 'node:crypto';
import { clearSessionCookies, login, publicUser, registerPatient, setCsrfCookie } from '../services/authService.js';

export async function issueCsrfToken(req, res) {
  const token = randomBytes(32).toString('hex');
  setCsrfCookie(res, token);
  res.json({ data: { csrfToken: token } });
}

export async function register(req, res) {
  const user = await registerPatient(req.validatedBody, res);
  res.status(201).json({ data: { user }, message: 'Patient account created.' });
}

export async function signIn(req, res) {
  const user = await login(req.validatedBody, res);
  res.json({ data: { user }, message: 'Signed in.' });
}

export async function me(req, res) {
  res.json({ data: { user: publicUser(req.user) } });
}

export async function signOut(req, res) {
  clearSessionCookies(res);
  res.json({ data: { signedOut: true }, message: 'Signed out.' });
}
