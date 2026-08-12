module.exports = {
  secret: process.env.JWT_SECRET || 'fallback_dev_secret',
  expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  cookieExpiresIn: parseInt(process.env.JWT_COOKIE_EXPIRES_IN || '7', 10),
};
