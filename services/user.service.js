const User = require('../models/User');
const { ApiError } = require('../utils/error');
const { publishEmailJob } = require('../queues/email.queue');
const cache = require('../cache');

const ROLE_LIST_CACHE_TTL_SECONDS = 600; // 10 min — dropdown data, changes rarely
const roleListCacheKey = (role) => `users:byRole:${role}`;
// Every role's cached list is invalidated together on any user write, since
// a single edit (e.g. a status change) can't cheaply tell us which specific
// role-keyed cache entries it affects.
const invalidateRoleListCache = () => cache.delByPattern('users:byRole:*');

const buildQuery = (query) => {
  const filter = {};
  if (query.role) filter.role = query.role;
  if (query.status) filter.status = query.status;
  if (query.search) {
    filter.$or = [
      { name: { $regex: query.search, $options: 'i' } },
      { email: { $regex: query.search, $options: 'i' } },
    ];
  }
  return filter;
};

const list = async (query) => {
  const page = query.page || 1;
  const limit = query.limit || 10;
  const filter = buildQuery(query);
  const skip = (page - 1) * limit;
  const [total, users] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter).populate('teamLead', 'name email').sort({ createdAt: -1 }).skip(skip).limit(limit),
  ]);
  return { users, total, page, limit, totalPages: Math.ceil(total / limit) };
};

const getById = async (id) => {
  const user = await User.findById(id).populate('teamLead', 'name email');
  if (!user) throw new ApiError('User not found', 404);
  return user;
};

const create = async (data, createdBy) => {
  const existing = await User.findOne({ email: data.email });
  if (existing) throw new ApiError('Email already in use', 409);
  const user = await User.create({ ...data, createdBy });

  // Queued, not sent inline — admin's "create user" request returns
  // immediately instead of waiting on an SMTP round trip.
  await publishEmailJob({
    template: 'welcome',
    to: user.email,
    data: { name: user.name, role: user.role },
  });

  await invalidateRoleListCache();
  return user;
};

const update = async (id, data) => {
  const user = await User.findById(id);
  if (!user) throw new ApiError('User not found', 404);
  if (data.email && data.email !== user.email) {
    const exists = await User.findOne({ email: data.email });
    if (exists) throw new ApiError('Email already in use', 409);
  }
  Object.assign(user, data);
  await user.save();
  await invalidateRoleListCache();
  return user;
};

const remove = async (id) => {
  const user = await User.findById(id);
  if (!user) throw new ApiError('User not found', 404);
  await user.deleteOne();
  await invalidateRoleListCache();
};

const updateStatus = async (id, status) => {
  const user = await User.findById(id);
  if (!user) throw new ApiError('User not found', 404);
  user.status = status;
  await user.save();
  await invalidateRoleListCache();
  return user;
};

const getByRole = async (role) => {
  const cacheKey = roleListCacheKey(role);
  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  const users = await User.find({ role, status: 'ACTIVE' }).select('name email avatar').sort({ name: 1 });
  await cache.set(cacheKey, users, ROLE_LIST_CACHE_TTL_SECONDS);
  return users;
};

module.exports = { list, getById, create, update, remove, updateStatus, getByRole };
