const { validationResult } = require('express-validator');
const { ApiError } = require('../utils/error');

/**
 * Runs after express-validator chain.
 * Collects errors and returns a 422 with a structured error list.
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  const formatted = errors.array().map((e) => ({ field: e.path, message: e.msg }));
  next(new ApiError('Validation failed', 422, formatted));
};

module.exports = { validate };
