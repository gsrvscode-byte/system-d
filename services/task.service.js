const Task = require('../models/Task');
const Comment = require('../models/Comment');
const Activity = require('../models/Activity');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { ApiError } = require('../utils/error');
const { publishEmailJob } = require('../queues/email.queue');
const cache = require('../cache');

const TASK_CACHE_TTL_SECONDS = 300; // 5 min — invalidated explicitly on every write below anyway
const taskCacheKey = (id) => `task:${id}`;

/**
 * Fans out a "task-assigned" email job to each given user ID.
 * Looked up in one query rather than N+1 queries per recipient.
 * Kept as its own helper since both create() and update() need it.
 */
const notifyAssignedUsersByEmail = async (userIds, task) => {
  if (!userIds || userIds.length === 0) return;

  const users = await User.find({ _id: { $in: userIds } }).select('name email');
  await Promise.all(
    users.map((u) =>
      publishEmailJob({
        template: 'task-assigned',
        to: u.email,
        data: {
          name: u.name,
          taskTitle: task.title,
          priority: task.priority,
          dueDate: task.dueDate,
        },
      })
    )
  );
};

const buildQuery = (query) => {
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.priority) filter.priority = query.priority;
  if (query.assignedTo) {
    // Support both legacy and new assignment structure
    filter.$or = [
      { assignedTo: query.assignedTo },
      { assignedDevelopers: query.assignedTo },
      { currentOwner: query.assignedTo },
    ];
  }
  if (query.teamLead) filter.teamLead = query.teamLead;
  if (query.search) {
    filter.$or = filter.$or || [];
    filter.$or.push(
      { title: { $regex: query.search, $options: 'i' } },
      { description: { $regex: query.search, $options: 'i' } },
    );
  }
  if (query.dueDate) {
    const d = new Date(query.dueDate);
    filter.dueDate = { $gte: new Date(d.setHours(0, 0, 0, 0)), $lte: new Date(d.setHours(23, 59, 59, 999)) };
  }
  if (query.createdDate) {
    const d = new Date(query.createdDate);
    filter.createdAt = { $gte: new Date(d.setHours(0, 0, 0, 0)), $lte: new Date(d.setHours(23, 59, 59, 999)) };
  }
  return filter;
};

const list = async (query) => {
  const page = query.page || 1;
  const limit = query.limit || 10;
  const filter = buildQuery(query);
  const skip = (page - 1) * limit;
  const sortBy = query.sortBy || 'createdAt';
  const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
  const sort = { [sortBy]: sortOrder };

  const [total, tasks] = await Promise.all([
    Task.countDocuments(filter),
    Task.find(filter)
      .populate('assignedTo', 'name email avatar')
      .populate('assignedBy', 'name email avatar')
      .populate('teamLead', 'name email avatar')
      .populate('assignedDevelopers', 'name email avatar')
      .populate('currentOwner', 'name email avatar')
      .sort(sort)
      .skip(skip)
      .limit(limit),
  ]);
  return { tasks, total, page, limit, totalPages: Math.ceil(total / limit) };
};

const getById = async (id) => {
  const cacheKey = taskCacheKey(id);
  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  const task = await Task.findById(id)
    .populate('assignedTo', 'name email avatar')
    .populate('assignedBy', 'name email avatar')
    .populate('teamLead', 'name email avatar')
    .populate('assignedDevelopers', 'name email avatar')
    .populate('currentOwner', 'name email avatar')
    .populate('createdBy', 'name email');
  if (!task) throw new ApiError('Task not found', 404);

  await cache.set(cacheKey, task, TASK_CACHE_TTL_SECONDS);
  return task;
};

const create = async (data, user) => {
  const payload = { ...data };
  payload.createdBy = user._id;
  payload.assignedBy = user._id;
  
  // Handle assignment logic
  if (data.assignmentType === 'TEAM_LEAD') {
    payload.teamLead = data.teamLead || null;
    payload.currentOwner = data.teamLead || null;
    // If developers are provided, assign them
    if (data.assignedDevelopers && data.assignedDevelopers.length > 0) {
      payload.assignedDevelopers = data.assignedDevelopers;
    }
    // For backward compatibility, set assignedTo to first developer or team lead
    payload.assignedTo = data.assignedDevelopers?.[0] || data.teamLead || null;
  } else {
    // DIRECT_DEVELOPER assignment
    payload.assignmentType = 'DIRECT_DEVELOPER';
    if (data.assignedDevelopers && data.assignedDevelopers.length > 0) {
      payload.assignedDevelopers = data.assignedDevelopers;
      payload.currentOwner = data.assignedDevelopers[0];
      payload.assignedTo = data.assignedDevelopers[0];
    } else if (data.assignedTo) {
      // Legacy support
      payload.assignedDevelopers = [data.assignedTo];
      payload.currentOwner = data.assignedTo;
    }
  }
  
  const task = await Task.create(payload);

  await Activity.create({
    task: task._id,
    user: user._id,
    action: 'TASK_CREATED',
    newValue: { title: task.title, status: task.status, priority: task.priority },
  });

  // Send in-app notifications to assigned developers
  if (task.assignedDevelopers && task.assignedDevelopers.length > 0) {
    await Notification.insertMany(
      task.assignedDevelopers.map((devId) => ({
        user: devId,
        title: 'New Task Assigned',
        message: `You have been assigned to "${task.title}"`,
      }))
    );
    // Email is queued (not sent inline) so task creation doesn't wait on SMTP.
    await notifyAssignedUsersByEmail(task.assignedDevelopers, task);
  } else if (task.teamLead) {
    await Notification.create({
      user: task.teamLead,
      title: 'New Task Assigned',
      message: `You have been assigned to "${task.title}"`,
    });
    await notifyAssignedUsersByEmail([task.teamLead], task);
  }
  return task;
};

const update = async (id, data, user) => {
  const task = await Task.findById(id);
  if (!task) throw new ApiError('Task not found', 404);

  // Captured before Object.assign(task, data) below overwrites it — the
  // notification block further down needs the PRE-update developer list to
  // diff against, not the post-update one.
  const previousAssignedDevelopers = (task.assignedDevelopers || []).map(String);

  const changes = [];
  if (data.status && data.status !== task.status) {
    changes.push({ action: 'STATUS_CHANGED', oldValue: task.status, newValue: data.status });
  }
  if (data.priority && data.priority !== task.priority) {
    changes.push({ action: 'PRIORITY_CHANGED', oldValue: task.priority, newValue: data.priority });
  }
  
  // Handle assignment updates
  if (data.assignedDevelopers) {
    const oldDevs = task.assignedDevelopers || [];
    const newDevs = data.assignedDevelopers;
    if (JSON.stringify(oldDevs.sort()) !== JSON.stringify(newDevs.sort())) {
      changes.push({ action: 'ASSIGNED_USER_CHANGED', oldValue: oldDevs, newValue: newDevs });
      // Update assignedTo for backward compatibility
      data.assignedTo = newDevs[0] || null;
      data.currentOwner = newDevs[0] || task.teamLead || null;
    }
  }
  
  if (data.assignedTo && String(data.assignedTo) !== String(task.assignedTo || '')) {
    changes.push({ action: 'ASSIGNED_USER_CHANGED', oldValue: task.assignedTo, newValue: data.assignedTo });
  }

  Object.assign(task, data);
  await task.save();

  if (changes.length > 0) {
    await Activity.insertMany(
      changes.map((c) => ({ task: task._id, user: user._id, ...c })),
    );
  }
  
  // Send notifications for new assignments
  if (data.assignedDevelopers && data.assignedDevelopers.length > 0) {
    // BUGFIX: comparing against `previousAssignedDevelopers` (captured
    // before Object.assign(task, data) ran) rather than `task.assignedDevelopers`
    // (which by this point already equals the NEW list) — and normalizing
    // both sides to strings, since Array.includes() uses strict equality and
    // an ObjectId never strictly equals a string with the same value.
    // Without both fixes this either re-notifies every developer on every
    // update (string-vs-ObjectId bug) or never notifies anyone (comparing
    // the new list to itself after the mutation).
    const newAssignments = data.assignedDevelopers.filter(
      (devId) => !previousAssignedDevelopers.includes(String(devId))
    );
    if (newAssignments.length > 0) {
      await Notification.insertMany(
        newAssignments.map((devId) => ({
          user: devId,
          title: 'Task Reassigned',
          message: `You have been assigned to "${task.title}"`,
        }))
      );
      await notifyAssignedUsersByEmail(newAssignments, task);
    }
  } else if (data.assignedTo) {
    await Notification.create({
      user: data.assignedTo,
      title: 'Task Reassigned',
      message: `You have been assigned to "${task.title}"`,
    });
    await notifyAssignedUsersByEmail([data.assignedTo], task);
  }

  // Notify on status change (separate from assignment) so watchers know
  // progress moved, not just who owns it.
  const statusChange = changes.find((c) => c.action === 'STATUS_CHANGED');
  if (statusChange) {
    const watcherId = task.currentOwner || task.assignedTo;
    if (watcherId) {
      const watcher = await User.findById(watcherId).select('name email');
      if (watcher) {
        await publishEmailJob({
          template: 'task-status-changed',
          to: watcher.email,
          data: {
            name: watcher.name,
            taskTitle: task.title,
            oldStatus: statusChange.oldValue,
            newStatus: statusChange.newValue,
          },
        });
      }
    }
  }

  await cache.del(taskCacheKey(task._id));
  return task;
};

const remove = async (id, user) => {
  const task = await Task.findById(id);
  if (!task) throw new ApiError('Task not found', 404);
  await Activity.create({ task: task._id, user: user._id, action: 'TASK_DELETED', oldValue: task.title });
  await Comment.deleteMany({ task: task._id });
  await task.deleteOne();
  await cache.del(taskCacheKey(id));
};

const updateStatus = async (id, status, user) => {
  const task = await Task.findById(id);
  if (!task) throw new ApiError('Task not found', 404);
  const oldStatus = task.status;
  task.status = status;
  await task.save();
  await Activity.create({ task: task._id, user: user._id, action: 'STATUS_CHANGED', oldValue: oldStatus, newValue: status });
  await cache.del(taskCacheKey(id));
  return task;
};

const assign = async (id, assignedTo, user) => {
  const task = await Task.findById(id);
  if (!task) throw new ApiError('Task not found', 404);

  // BUGFIX: the route validator only checks that `assignedTo` LOOKS like a
  // valid Mongo ObjectId (regex format), never that a user with that ID
  // actually exists. Without this check, assigning to a stale/typo'd/
  // nonexistent ID silently "succeeded" — the task pointed at a ghost user,
  // and Notification.create() below would create an orphan notification
  // for nobody.
  const assignee = await User.findById(assignedTo);
  if (!assignee) throw new ApiError('Assigned user not found', 404);

  const oldAssigned = task.assignedTo;
  task.assignedTo = assignedTo;
  await task.save();
  await Activity.create({ task: task._id, user: user._id, action: 'ASSIGNED_USER_CHANGED', oldValue: oldAssigned, newValue: assignedTo });
  await Notification.create({ user: assignedTo, title: 'Task Assigned', message: `You have been assigned to "${task.title}"` });
  await notifyAssignedUsersByEmail([assignedTo], task);
  await cache.del(taskCacheKey(id));
  return task;
};

const addComment = async (taskId, userId, comment) => {
  const task = await Task.findById(taskId);
  if (!task) throw new ApiError('Task not found', 404);
  const c = await Comment.create({ task: taskId, user: userId, comment });
  await Activity.create({ task: taskId, user: userId, action: 'COMMENT_ADDED', newValue: comment });
  return c;
};

const getComments = async (taskId) => {
  const task = await Task.findById(taskId);
  if (!task) throw new ApiError('Task not found', 404);
  return Comment.find({ task: taskId }).populate('user', 'name email avatar').sort({ createdAt: -1 });
};

const deleteComment = async (commentId, user) => {
  const comment = await Comment.findById(commentId);
  if (!comment) throw new ApiError('Comment not found', 404);
  if (String(comment.user) !== String(user._id) && user.role !== 'ADMIN') {
    throw new ApiError('Not authorized to delete this comment', 403);
  }
  await comment.deleteOne();
};

module.exports = { list, getById, create, update, remove, updateStatus, assign, addComment, getComments, deleteComment };
