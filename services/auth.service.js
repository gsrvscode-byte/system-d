// const User = require('../models/User');
// const { ApiError } = require('../utils/error');
// const { signToken } = require('../utils/jwt');
// const jwtConfig = require('../config/jwt');

// const login = async (email, password) => {
//   const user = await User.findOne({ email }).select('+password');
//   if (!user) throw new ApiError('Invalid credentials', 401);
//   if (user.status === 'INACTIVE') throw new ApiError('Account is deactivated', 403);

//   const isMatch = await user.matchPassword(password);
//   if (!isMatch) throw new ApiError('Invalid credentials', 401);

//   const token = signToken({ id: user._id, role: user.role });
//   return { token, user: user.toJSON() };
// };

// const getMe = async (userId) => {
//   const user = await User.findById(userId);
//   if (!user) throw new ApiError('User not found', 404);
//   return user;
// };

// const changePassword = async (userId, currentPassword, newPassword) => {
//   const user = await User.findById(userId).select('+password');
//   if (!user) throw new ApiError('User not found', 404);

//   const isMatch = await user.matchPassword(currentPassword);
//   if (!isMatch) throw new ApiError('Current password is incorrect', 400);

//   user.password = newPassword;
//   await user.save();
// };

// module.exports = { login, getMe, changePassword };

const User = require('../models/User');
const { ApiError } = require('../utils/error');
const { signToken } = require('../utils/jwt');

const register = async (payload) => {
  const { name, email, password, phone } = payload;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError('Email already registered', 409);
  }

  const user = await User.create({
    name,
    email,
    password,
    phone,
    role: 'DEVELOPER'
  });

  const token = signToken({
    id: user._id,
    role: user.role
  });

  return {
    token,
    user: user.toJSON()
  };
};

const login = async (email, password) => {
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    throw new ApiError('Invalid credentials', 401);
  }

  if (user.status === 'INACTIVE') {
    throw new ApiError('Account is deactivated', 403);
  }

  const isMatch = await user.matchPassword(password);

  if (!isMatch) {
    throw new ApiError('Invalid credentials', 401);
  }

  const token = signToken({
    id: user._id,
    role: user.role
  });

  return {
    token,
    user: user.toJSON()
  };
};

const getMe = async (userId) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError('User not found', 404);
  }

  return user;
};

const changePassword = async (userId, currentPassword, newPassword) => {
  const user = await User.findById(userId).select('+password');

  if (!user) {
    throw new ApiError('User not found', 404);
  }

  const isMatch = await user.matchPassword(currentPassword);

  if (!isMatch) {
    throw new ApiError('Current password is incorrect', 400);
  }

  user.password = newPassword;

  await user.save();
};

module.exports = {
  register,
  login,
  getMe,
  changePassword
};