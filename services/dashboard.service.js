const Task = require('../models/Task');
const Activity = require('../models/Activity');
const { ApiError } = require('../utils/error');
const cache = require('../cache');

const DASHBOARD_CACHE_TTL_SECONDS = 30;
const dashboardCacheKey = (userId, role) => `dashboard:${userId}:${role}`;

const startOfDay = (d) => new Date(new Date(d).setHours(0, 0, 0, 0));
const endOfDay = (d) => new Date(new Date(d).setHours(23, 59, 59, 999));

const getStats = async (user) => {
  let filter = {};
  if (user.role === 'DEVELOPER') {
    // Support both legacy and new assignment structure
    filter.$or = [
      { assignedTo: user._id },
      { assignedDevelopers: user._id },
      { currentOwner: user._id },
    ];
  }
  if (user.role === 'TEAM_LEAD') filter.teamLead = user._id;

  const [total, pending, inProgress, completed, highPriority, criticalPriority, dueToday, overdue] = await Promise.all([
    Task.countDocuments(filter),
    Task.countDocuments({ ...filter, status: 'PENDING' }),
    Task.countDocuments({ ...filter, status: 'IN_PROGRESS' }),
    Task.countDocuments({ ...filter, status: 'COMPLETED' }),
    Task.countDocuments({ ...filter, priority: 'HIGH' }),
    Task.countDocuments({ ...filter, priority: 'CRITICAL' }),
    Task.countDocuments({ ...filter, dueDate: { $gte: startOfDay(new Date()), $lte: endOfDay(new Date()) } }),
    Task.countDocuments({ ...filter, dueDate: { $lt: new Date() }, status: { $ne: 'COMPLETED' } }),
  ]);

  return { total, pending, inProgress, completed, highPriority, criticalPriority, dueToday, overdue };
};

const getRecentActivity = async (user) => {
  let taskFilter = {};
  if (user.role === 'DEVELOPER') {
    taskFilter.$or = [
      { assignedTo: user._id },
      { assignedDevelopers: user._id },
      { currentOwner: user._id },
    ];
  }
  if (user.role === 'TEAM_LEAD') taskFilter.teamLead = user._id;

  const tasks = await Task.find(taskFilter).select('_id');
  const taskIds = tasks.map((t) => t._id);
  if (taskIds.length === 0) return [];
  return Activity.find({ task: { $in: taskIds } })
    .populate('user', 'name email avatar')
    .populate('task', 'title taskId')
    .sort({ createdAt: -1 })
    .limit(10);
};

const getRecentTasks = async (user) => {
  let filter = {};
  if (user.role === 'DEVELOPER') {
    filter.$or = [
      { assignedTo: user._id },
      { assignedDevelopers: user._id },
      { currentOwner: user._id },
    ];
  }
  if (user.role === 'TEAM_LEAD') filter.teamLead = user._id;
  return Task.find(filter)
    .populate('assignedTo', 'name email avatar')
    .populate('assignedDevelopers', 'name email avatar')
    .sort({ createdAt: -1 })
    .limit(5);
};

const getUpcomingDeadlines = async (user) => {
  let filter = { dueDate: { $gte: new Date() }, status: { $ne: 'COMPLETED' } };
  if (user.role === 'DEVELOPER') {
    filter.$or = [
      { assignedTo: user._id },
      { assignedDevelopers: user._id },
      { currentOwner: user._id },
    ];
  }
  if (user.role === 'TEAM_LEAD') filter.teamLead = user._id;
  return Task.find(filter)
    .populate('assignedTo', 'name email avatar')
    .populate('assignedDevelopers', 'name email avatar')
    .sort({ dueDate: 1 })
    .limit(5);
};

const getDashboard = async (user) => {
  const cacheKey = dashboardCacheKey(user._id, user.role);

  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  const [stats, recentActivity, recentTasks, upcomingDeadlines] = await Promise.all([
    getStats(user),
    getRecentActivity(user),
    getRecentTasks(user),
    getUpcomingDeadlines(user),
  ]);
  const dashboard = { stats, recentActivity, recentTasks, upcomingDeadlines };

  // A short TTL rather than write-time invalidation is deliberate: a single
  // task write can affect the admin's global stats, its team lead's stats,
  // *and* every assigned developer's stats simultaneously — precisely
  // targeting all of those cached entries costs more than just accepting up
  // to 30s of staleness on a dashboard view (which is not correctness
  // -critical the way order/payment data would be).
  await cache.set(cacheKey, dashboard, DASHBOARD_CACHE_TTL_SECONDS);

  return dashboard;
};

module.exports = { getDashboard };
