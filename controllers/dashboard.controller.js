const { getDashboard } = require('../services/dashboard.service');
const { success } = require('../utils/response');

const getDashboardData = async (req, res, next) => {
  try {
    const data = await getDashboard(req.user);
    return success(res, { statusCode: 200, message: 'Dashboard data fetched', data });
  } catch (err) { next(err); }
};

module.exports = { getDashboardData };
