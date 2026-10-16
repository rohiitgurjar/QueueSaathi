import * as clinicService from '../services/clinicService.js';
import * as queueService from '../services/queueService.js';

export async function listClinics(req, res) {
  const clinics = await clinicService.listClinics(req.validatedQuery, req.user ?? null);
  res.json({ data: { clinics } });
}

export async function getClinic(req, res) {
  const clinic = await clinicService.getClinic(req.params.clinicId, req.user ?? null);
  res.json({ data: { clinic } });
}

export async function createClinic(req, res) {
  const clinic = await clinicService.createClinic(req.validatedBody);
  res.status(201).json({ data: { clinic }, message: 'Clinic created.' });
}

export async function updateClinic(req, res) {
  const clinic = await clinicService.updateClinic(req.params.clinicId, req.validatedBody);
  res.json({ data: { clinic }, message: 'Clinic updated.' });
}

export async function deactivateClinic(req, res) {
  const clinic = await clinicService.deactivateClinic(req.params.clinicId);
  res.json({ data: { clinic }, message: 'Clinic deactivated.' });
}

export async function listCategories(req, res) {
  const includeInactive = req.user?.role === 'admin' && req.validatedQuery.includeInactive === 'true';
  const categories = await clinicService.listCategories(includeInactive);
  res.json({ data: { categories } });
}

export async function createCategory(req, res) {
  const category = await clinicService.createCategory(req.validatedBody.name);
  res.status(201).json({ data: { category }, message: 'Category created.' });
}

export async function updateCategory(req, res) {
  const category = await clinicService.updateCategory(req.params.categoryId, req.validatedBody);
  res.json({ data: { category }, message: 'Category updated.' });
}

export async function deleteCategory(req, res) {
  await clinicService.deleteCategory(req.params.categoryId);
  res.json({ data: { deleted: true }, message: 'Category deleted.' });
}

export async function joinQueue(req, res) {
  const token = await queueService.joinQueue(req.params.clinicId, req.user._id);
  res.status(201).json({ data: { token }, message: 'Queue token created.' });
}

export async function publicQueueStatus(req, res) {
  const queue = await queueService.getPublicQueueStatus(req.params.clinicId);
  res.json({ data: { queue } });
}

export async function staffQueue(req, res) {
  const queue = await queueService.getStaffQueue(req.params.clinicId, req.user);
  res.json({ data: { queue } });
}

export async function callNext(req, res) {
  const token = await queueService.callNextToken(req.params.clinicId, req.user);
  res.json({ data: { token }, message: token ? 'Next token called.' : 'No waiting patients.' });
}
