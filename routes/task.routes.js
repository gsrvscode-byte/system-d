const express = require('express');
const { create, update, updateStatus, assign, list: listValidator, comment } = require('../validators/task.validator');
const { validate } = require('../middleware/validation.middleware');
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { upload } = require('../middleware/upload.middleware');
const {
  list, getById, create: createCtrl, update: updateCtrl, remove,
  updateStatus: updateStatusCtrl, assign: assignCtrl,
  addComment, getComments, deleteComment, uploadAttachment,
} = require('../controllers/task.controller');

const router = express.Router();

router.use(protect);

// Task CRUD
router.get('/', listValidator, validate, list);
router.get('/:id', getById);
router.post('/', authorize('ADMIN', 'TEAM_LEAD'), create, validate, createCtrl);
router.put('/:id', authorize('ADMIN', 'TEAM_LEAD'), update, validate, updateCtrl);
router.delete('/:id', authorize('ADMIN', 'TEAM_LEAD'), remove);
router.patch('/:id/status', authorize('ADMIN', 'TEAM_LEAD', 'DEVELOPER'), updateStatus, validate, updateStatusCtrl);
router.patch('/:id/assign', authorize('ADMIN', 'TEAM_LEAD'), assign, validate, assignCtrl);

// Comments
router.post('/:id/comments', comment, validate, addComment);
router.get('/:id/comments', getComments);
router.delete('/:taskId/comments/:commentId', deleteComment);

// Attachments
router.post('/:id/attachments', authorize('ADMIN', 'TEAM_LEAD', 'DEVELOPER'), upload.single('file'), uploadAttachment);

module.exports = router;
