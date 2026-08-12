const { ApiError } = require('../utils/error');

/**
 * @param {...string} roles - Uppercase role names allowed to pass.
 */
const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return next(new ApiError('Not authorized', 401));
  if (!roles.includes(req.user.role)) {
    return next(new ApiError(`Role ${req.user.role} is not authorized for this action`, 403));
  }
  next();
};

module.exports = { authorize };
