const taskService = require('../services/task.service');
const Task = require('../models/Task');
const { success, paginate } = require('../utils/response');
const { ApiError } = require('../utils/error');

const list = async (req, res, next) => {
  try {
    const result = await taskService.list(req.query);
    return success(res, {
      statusCode: 200,
      message: 'Tasks fetched',
      data: result.tasks,
      pagination: paginate(result.total, result.page, result.limit),
    });
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const task = await taskService.getById(req.params.id);
    return success(res, { statusCode: 200, message: 'Task fetched', data: task });
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const task = await taskService.create(req.body, req.user);
    return success(res, { statusCode: 201, message: 'Task created successfully', data: task });
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const task = await taskService.update(req.params.id, req.body, req.user);
    return success(res, { statusCode: 200, message: 'Task updated successfully', data: task });
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    await taskService.remove(req.params.id, req.user);
    return success(res, { statusCode: 200, message: 'Task deleted successfully' });
  } catch (err) { next(err); }
};

const updateStatus = async (req, res, next) => {
  try {
    const task = await taskService.updateStatus(req.params.id, req.body.status, req.user);
    return success(res, { statusCode: 200, message: 'Task status updated', data: task });
  } catch (err) { next(err); }
};

const assign = async (req, res, next) => {
  try {
    const task = await taskService.assign(req.params.id, req.body.assignedTo, req.user);
    return success(res, { statusCode: 200, message: 'Task assigned successfully', data: task });
  } catch (err) { next(err); }
};

const addComment = async (req, res, next) => {
  try {
    const comment = await taskService.addComment(req.params.id, req.user._id, req.body.comment);
    return success(res, { statusCode: 201, message: 'Comment added', data: comment });
  } catch (err) { next(err); }
};

const getComments = async (req, res, next) => {
  try {
    const comments = await taskService.getComments(req.params.id);
    return success(res, { statusCode: 200, message: 'Comments fetched', data: comments });
  } catch (err) { next(err); }
};

const deleteComment = async (req, res, next) => {
  try {
    await taskService.deleteComment(req.params.commentId, req.user);
    return success(res, { statusCode: 200, message: 'Comment deleted' });
  } catch (err) { next(err); }
};

const uploadAttachment = async (req, res, next) => {
  try {
    if (!req.file) return next(new ApiError('No file uploaded', 400));
    const task = await Task.findById(req.params.id);
    if (!task) return next(new ApiError('Task not found', 404));
    task.attachments.push({
      filename: req.file.filename,
      originalName: req.file.originalname,
      // BUGFIX: req.file.path is the file's absolute path on the server's
      // disk (e.g. "/usr/src/app/uploads/tasks/171234-abc.png") — it leaks
      // internal server directory structure and isn't something the client
      // can actually use. app.js serves the uploads/ directory statically
      // at "/uploads", so the correct client-usable value is a relative URL
      // built from the same "tasks/<filename>" shape multer already wrote
      // the file to, not the raw disk path.
      path: `/uploads/tasks/${req.file.filename}`,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });
    await task.save();
    return success(res, { statusCode: 200, message: 'File uploaded', data: task.attachments[task.attachments.length - 1] });
  } catch (err) { next(err); }
};

module.exports = { list, getById, create, update, remove, updateStatus, assign, addComment, getComments, deleteComment, uploadAttachment };
