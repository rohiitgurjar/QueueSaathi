import * as queueService from '../services/queueService.js';

export async function myActive(req, res) {
  const tokens = await queueService.listMyActiveTokens(req.user._id);
  res.json({ data: { tokens } });
}

export async function myHistory(req, res) {
  const tokens = await queueService.listMyHistory(req.user._id);
  res.json({ data: { tokens } });
}

export async function getToken(req, res) {
  const token = await queueService.getTokenForActor(req.params.tokenId, req.user);
  res.json({ data: { token } });
}

export async function cancelToken(req, res) {
  const token = await queueService.cancelToken(req.params.tokenId, req.validatedBody.reason ?? '', req.user);
  res.json({ data: { token }, message: 'Queue token cancelled.' });
}

export async function serveToken(req, res) {
  const token = await queueService.serveToken(req.params.tokenId, req.user);
  res.json({ data: { token }, message: 'Token marked as served.' });
}

export async function skipToken(req, res) {
  const token = await queueService.skipToken(req.params.tokenId, req.validatedBody.reason, req.user);
  res.json({ data: { token }, message: 'Token skipped.' });
}
