import Clinic from '../models/Clinic.js';
import ClinicCategory from '../models/ClinicCategory.js';
import QueueToken from '../models/QueueToken.js';
import ApiError from '../utils/ApiError.js';
import { currentSessionKey } from '../utils/session.js';

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function listClinics(query, actor = null) {
  const filter = {};
  if (!(actor?.role === 'admin' && query.includeInactive === 'true')) filter.active = true;
  if (query.categoryId) filter.category = query.categoryId;
  if (query.search) {
    const safeSearch = new RegExp(escapeRegex(query.search), 'i');
    filter.$or = [{ name: safeSearch }, { description: safeSearch }, { address: safeSearch }];
  }

  const clinics = await Clinic.find(filter)
    .populate('category', 'name slug active')
    .sort({ name: 1 })
    .limit(100)
    .lean();

  const clinicIds = clinics.map((clinic) => clinic._id);
  const sessionKey = currentSessionKey();
  const groupedQueue = clinicIds.length
    ? await QueueToken.aggregate([
      { $match: { clinic: { $in: clinicIds }, sessionKey, status: { $in: ['WAITING', 'CALLED'] } } },
      {
        $group: {
          _id: '$clinic',
          waitingCount: { $sum: { $cond: [{ $eq: ['$status', 'WAITING'] }, 1, 0] } },
          calledCount: { $sum: { $cond: [{ $eq: ['$status', 'CALLED'] }, 1, 0] } },
          currentTokenNumber: { $max: { $cond: [{ $eq: ['$status', 'CALLED'] }, '$tokenNumber', null] } },
        },
      },
    ])
    : [];
  const queueByClinic = new Map(groupedQueue.map((item) => [String(item._id), item]));

  return clinics.map((clinic) => {
    const queue = queueByClinic.get(String(clinic._id)) ?? { waitingCount: 0, calledCount: 0, currentTokenNumber: null };
    return {
      ...clinic,
      queue: {
        waitingCount: queue.waitingCount,
        currentTokenNumber: queue.currentTokenNumber,
        estimatedWaitMinutes: (queue.waitingCount + queue.calledCount) * clinic.averageServiceDurationMinutes,
        isEstimate: true,
      },
    };
  });
}

export async function getClinic(clinicId, actor = null) {
  const filter = { _id: clinicId };
  if (actor?.role !== 'admin') filter.active = true;
  const clinic = await Clinic.findOne(filter).populate('category', 'name slug active').lean();
  if (!clinic) throw new ApiError(404, 'CLINIC_NOT_FOUND', 'Clinic not found.');

  const sessionKey = currentSessionKey();
  const [waitingCount, currentToken] = await Promise.all([
    QueueToken.countDocuments({ clinic: clinicId, sessionKey, status: 'WAITING' }),
    QueueToken.findOne({ clinic: clinicId, sessionKey, status: 'CALLED' }).select('tokenNumber calledAt').lean(),
  ]);
  return {
    ...clinic,
    queue: {
      waitingCount,
      currentTokenNumber: currentToken?.tokenNumber ?? null,
      estimatedWaitMinutes: (waitingCount + (currentToken ? 1 : 0)) * clinic.averageServiceDurationMinutes,
      isEstimate: true,
    },
  };
}

export async function createClinic(input) {
  const category = await ClinicCategory.findOne({ _id: input.categoryId, active: true });
  if (!category) throw new ApiError(400, 'CATEGORY_INVALID', 'Choose an active clinic category.');
  const clinic = await Clinic.create({
    name: input.name,
    description: input.description,
    category: category._id,
    address: input.address,
    openingHours: input.openingHours,
    averageServiceDurationMinutes: input.averageServiceDurationMinutes,
    active: input.active ?? true,
    isDemo: false,
  });
  return clinic.populate('category', 'name slug active');
}

export async function updateClinic(clinicId, input) {
  const update = { ...input };
  if (update.active === true && !update.categoryId) {
    const current = await Clinic.findById(clinicId).select('category');
    if (!current) throw new ApiError(404, 'CLINIC_NOT_FOUND', 'Clinic not found.');
    const currentCategory = await ClinicCategory.findOne({ _id: current.category, active: true });
    if (!currentCategory) throw new ApiError(400, 'CATEGORY_INVALID', 'Activate or change this clinic’s category before activating the clinic.');
  }
  if (update.categoryId) {
    const category = await ClinicCategory.findOne({ _id: update.categoryId, active: true });
    if (!category) throw new ApiError(400, 'CATEGORY_INVALID', 'Choose an active clinic category.');
    update.category = category._id;
    delete update.categoryId;
  }
  const clinic = await Clinic.findByIdAndUpdate(clinicId, { $set: update }, { returnDocument: 'after', runValidators: true })
    .populate('category', 'name slug active');
  if (!clinic) throw new ApiError(404, 'CLINIC_NOT_FOUND', 'Clinic not found.');
  return clinic;
}

export async function deactivateClinic(clinicId) {
  const clinic = await Clinic.findByIdAndUpdate(clinicId, { $set: { active: false } }, { returnDocument: 'after' })
    .populate('category', 'name slug active');
  if (!clinic) throw new ApiError(404, 'CLINIC_NOT_FOUND', 'Clinic not found.');
  return clinic;
}

export async function listCategories(includeInactive = false) {
  return ClinicCategory.find(includeInactive ? {} : { active: true }).sort({ name: 1 }).lean();
}

function slugify(value) {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export async function createCategory(name) {
  try {
    return await ClinicCategory.create({ name, slug: slugify(name) });
  } catch (error) {
    if (error?.code === 11000) throw new ApiError(409, 'CATEGORY_EXISTS', 'That category already exists.');
    throw error;
  }
}

export async function updateCategory(categoryId, input) {
  const update = { ...input };
  if (update.active === false && await Clinic.exists({ category: categoryId, active: true })) {
    throw new ApiError(409, 'CATEGORY_IN_USE', 'Move or deactivate active clinics before deactivating this category.');
  }
  if (update.name) update.slug = slugify(update.name);
  try {
    const category = await ClinicCategory.findByIdAndUpdate(categoryId, { $set: update }, { returnDocument: 'after', runValidators: true });
    if (!category) throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'Category not found.');
    return category;
  } catch (error) {
    if (error?.code === 11000) throw new ApiError(409, 'CATEGORY_EXISTS', 'That category name is already in use.');
    throw error;
  }
}

export async function deleteCategory(categoryId) {
  const inUse = await Clinic.exists({ category: categoryId });
  if (inUse) throw new ApiError(409, 'CATEGORY_IN_USE', 'This category is assigned to a clinic. Deactivate it instead.');
  const category = await ClinicCategory.findByIdAndDelete(categoryId);
  if (!category) throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'Category not found.');
  return category;
}

export { escapeRegex };
