const Notification = require('../models/Notification');
const { success } = require('../utils/response');
const { ApiError } = require('../utils/error');
const { changePassword: changePasswordService } = require('../services/auth.service');

const getProfile = async (req, res, next) => {
  try {
    return success(res, { statusCode: 200, message: 'Profile fetched', data: req.user });
  } catch (err) { next(err); }
};

const updateProfile = async (req, res, next) => {
  try {
    const { name, phone, avatar } = req.body;
    if (name !== undefined) req.user.name = name;
    if (phone !== undefined) req.user.phone = phone;
    if (avatar !== undefined) req.user.avatar = avatar;
    await req.user.save();
    return success(res, { statusCode: 200, message: 'Profile updated', data: req.user });
  } catch (err) { next(err); }
};

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    // BUGFIX: this used to fetch the user and call .matchPassword() directly
    // in the controller, with no null-check on the fetch — if the account
    // were deleted between token issue and this request, that threw a raw
    // TypeError instead of a clean error. Reusing auth.service.changePassword
    // (which already does fetch + null-check + verify + rehash) fixes that
    // and removes the duplicated logic — this controller had its own copy of
    // exactly what auth.controller.js's changePasswordController already does.
    await changePasswordService(req.user._id, currentPassword, newPassword);
    return success(res, { statusCode: 200, message: 'Password changed successfully' });
  } catch (err) { next(err); }
};

const getNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50);
    const unreadCount = await Notification.countDocuments({ user: req.user._id, isRead: false });
    return success(res, { statusCode: 200, message: 'Notifications fetched', data: notifications, pagination: { unreadCount } });
  } catch (err) { next(err); }
};

const markNotificationRead = async (req, res, next) => {
  try {
    const n = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { isRead: true },
      { new: true },
    );
    if (!n) throw new ApiError('Notification not found', 404);
    return success(res, { statusCode: 200, message: 'Notification marked as read', data: n });
  } catch (err) { next(err); }
};

const markAllRead = async (req, res, next) => {
  try {
    await Notification.updateMany({ user: req.user._id, isRead: false }, { isRead: true });
    return success(res, { statusCode: 200, message: 'All notifications marked as read' });
  } catch (err) { next(err); }
};

module.exports = { getProfile, updateProfile, changePassword, getNotifications, markNotificationRead, markAllRead };
