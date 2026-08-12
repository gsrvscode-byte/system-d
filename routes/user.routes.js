const express = require('express');
const { create, update, updateStatus, list: listValidator } = require('../validators/user.validator');
const { validate } = require('../middleware/validation.middleware');
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { list, getById, create: createCtrl, update: updateCtrl, remove, updateStatus: updateStatusCtrl } = require('../controllers/user.controller');

const router = express.Router();

router.use(protect);

router.get('/', authorize('ADMIN'), listValidator, validate, list);
router.get('/developers', listValidator, validate, require('../controllers/user.controller').getDevelopers);
router.get('/team-leads', listValidator, validate, require('../controllers/user.controller').getTeamLeads);
router.get('/:id', authorize('ADMIN'), getById);
router.post('/', authorize('ADMIN'), create, validate, createCtrl);
router.put('/:id', authorize('ADMIN'), update, validate, updateCtrl);
router.delete('/:id', authorize('ADMIN'), remove);
router.patch('/:id/status', authorize('ADMIN'), updateStatus, validate, updateStatusCtrl);

module.exports = router;
