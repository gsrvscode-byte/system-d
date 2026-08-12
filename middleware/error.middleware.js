const { ApiError, notFound, errorHandler } = require('./error.middleware');

// Re-export so there's a single import point
module.exports = { ApiError, notFound, errorHandler };
