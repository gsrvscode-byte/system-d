const { verifyToken } = require('../utils/jwt');
const { ApiError } = require('../utils/error');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.token) {
      token = req.cookies.token;
    }
    if (!token) throw new ApiError('Not authorized, no token provided', 401);

    const decoded = verifyToken(token);
    const user = await User.findById(decoded.id);
    if (!user) throw new ApiError('User no longer exists', 401);
    if (user.status === 'INACTIVE') throw new ApiError('Account is deactivated', 403);

    req.user = user;
    next();
  } catch (err) {
    next(new ApiError(err.message || 'Not authorized', 401));
  }
};

module.exports = { protect };
