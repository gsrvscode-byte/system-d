const express = require('express');
const { update, changePassword } = require('../validators/profile.validator');
const { validate } = require('../middleware/validation.middleware');
const { protect } = require('../middleware/auth.middleware');
const { getProfile, updateProfile, changePassword: changePasswordCtrl, getNotifications, markNotificationRead, markAllRead } = require('../controllers/profile.controller');

const router = express.Router();

router.use(protect);

// Profile
router.get('/', getProfile);
router.put('/', update, validate, updateProfile);
router.put('/change-password', changePassword, validate, changePasswordCtrl);

// Notifications
router.get('/notifications', getNotifications);
router.patch('/notifications/:id/read', markNotificationRead);
router.patch('/notifications/read-all', markAllRead);

module.exports = router;
