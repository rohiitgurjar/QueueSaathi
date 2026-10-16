import { Router } from 'express';
import * as controller from '../controllers/clinicController.js';
import { optionalAuth, requireAuth, requireRoles } from '../middleware/authenticate.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import {
  cancelSchema,
  categoryCreateSchema,
  categoryQuerySchema,
  categoryUpdateSchema,
  clinicCreateSchema,
  clinicQuerySchema,
  clinicUpdateSchema,
  queueActionSchema,
} from '../validators/schemas.js';

const router = Router();

router.get('/categories', optionalAuth, validateQuery(categoryQuerySchema), controller.listCategories);
router.post('/categories', requireAuth, requireRoles('admin'), validateBody(categoryCreateSchema), controller.createCategory);
router.patch('/categories/:categoryId', requireAuth, requireRoles('admin'), validateBody(categoryUpdateSchema), controller.updateCategory);
router.delete('/categories/:categoryId', requireAuth, requireRoles('admin'), controller.deleteCategory);

router.get('/', optionalAuth, validateQuery(clinicQuerySchema), controller.listClinics);
router.post('/', requireAuth, requireRoles('admin'), validateBody(clinicCreateSchema), controller.createClinic);
router.get('/:clinicId', optionalAuth, controller.getClinic);
router.patch('/:clinicId', requireAuth, requireRoles('admin'), validateBody(clinicUpdateSchema), controller.updateClinic);
router.delete('/:clinicId', requireAuth, requireRoles('admin'), controller.deactivateClinic);

router.get('/:clinicId/queue/status', controller.publicQueueStatus);
router.post('/:clinicId/queue', requireAuth, requireRoles('patient'), controller.joinQueue);
router.get('/:clinicId/queue', requireAuth, requireRoles('staff', 'admin'), controller.staffQueue);
router.post('/:clinicId/queue/call-next', requireAuth, requireRoles('staff', 'admin'), controller.callNext);

export default router;
