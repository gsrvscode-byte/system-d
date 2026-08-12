/**
 * Standard API response helpers.
 * Every controller should use these so the response shape stays consistent.
 */
const success = (res, { statusCode = 200, message = 'Success', data = null, pagination = null }) => {
  const response = { success: true, message, data };
  if (pagination) response.pagination = pagination;
  return res.status(statusCode).json(response);
};

const error = (res, { statusCode = 500, message = 'Something went wrong', errors = [] }) => {
  const response = { success: false, message };
  if (errors.length > 0) response.errors = errors;
  return res.status(statusCode).json(response);
};

const paginate = (total, page, limit) => {
  const totalPages = Math.ceil(total / limit);
  return {
    total,
    page,
    limit,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
};

module.exports = { success, error, paginate };
