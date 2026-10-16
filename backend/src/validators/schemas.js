import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Choose a valid record.');
const email = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
const password = z.string().min(8, 'Use at least 8 characters.').max(128);
const name = z.string().trim().min(2).max(80);

export const registerSchema = z.object({ name, email, password }).strict();
export const loginSchema = z.object({ email, password: z.string().min(1).max(128) }).strict();

export const clinicCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(10).max(1200),
  categoryId: objectId,
  address: z.string().trim().min(4).max(240),
  openingHours: z.string().trim().min(3).max(120),
  averageServiceDurationMinutes: z.coerce.number().int().min(1).max(240),
  active: z.boolean().optional(),
}).strict();
export const clinicUpdateSchema = clinicCreateSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: 'Provide at least one clinic field to update.',
});

export const categoryCreateSchema = z.object({ name: z.string().trim().min(2).max(60) }).strict();
export const categoryUpdateSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  active: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, { message: 'Provide a category field to update.' });

export const staffCreateSchema = z.object({
  name,
  email,
  password,
  clinicIds: z.array(objectId).max(50).default([]),
}).strict();
export const staffAssignmentSchema = z.object({
  clinicIds: z.array(objectId).max(50),
}).strict();

export const queueActionSchema = z.object({
  reason: z.string().trim().min(3).max(240),
}).strict();
export const cancelSchema = z.object({
  reason: z.string().trim().min(3).max(240).optional(),
}).strict();

export const clinicQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  categoryId: objectId.optional(),
  includeInactive: z.enum(['true', 'false']).optional(),
}).strict();
export const categoryQuerySchema = z.object({
  includeInactive: z.enum(['true', 'false']).optional(),
}).strict();
