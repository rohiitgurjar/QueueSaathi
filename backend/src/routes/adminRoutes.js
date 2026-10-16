import { Router } from 'express';
import * as controller from '../controllers/adminController.js';
import { requireAuth, requireRoles } from '../middleware/authenticate.js';
import { validateBody } from '../middleware/validate.js';
import { staffAssignmentSchema, staffCreateSchema } from '../validators/schemas.js';

const router = Router();
router.use(requireAuth, requireRoles('admin'));
router.get('/stats', controller.getStats);
router.get('/staff', controller.listStaff);
router.post('/staff', validateBody(staffCreateSchema), controller.createStaff);
router.patch('/staff/:staffId/clinics', validateBody(staffAssignmentSchema), controller.assignStaffClinics);
router.delete('/staff/:staffId', controller.deactivateStaff);

export default router;
