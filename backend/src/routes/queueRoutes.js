import { Router } from 'express';
import * as controller from '../controllers/queueController.js';
import { requireAuth, requireRoles } from '../middleware/authenticate.js';
import { validateBody } from '../middleware/validate.js';
import { cancelSchema, queueActionSchema } from '../validators/schemas.js';

const router = Router();
router.use(requireAuth);
router.get('/my-active', requireRoles('patient'), controller.myActive);
router.get('/my-history', requireRoles('patient'), controller.myHistory);
router.get('/:tokenId', controller.getToken);
router.post('/:tokenId/cancel', requireRoles('patient', 'staff', 'admin'), validateBody(cancelSchema), controller.cancelToken);
router.post('/:tokenId/serve', requireRoles('staff', 'admin'), controller.serveToken);
router.post('/:tokenId/skip', requireRoles('staff', 'admin'), validateBody(queueActionSchema), controller.skipToken);

export default router;
