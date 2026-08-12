const userService = require('../services/user.service');
const { success, paginate } = require('../utils/response');

const list = async (req, res, next) => {
  try {
    const result = await userService.list(req.query);
    return success(res, {
      statusCode: 200,
      message: 'Users fetched',
      data: result.users,
      pagination: paginate(result.total, result.page, result.limit),
    });
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const user = await userService.getById(req.params.id);
    return success(res, { statusCode: 200, message: 'User fetched', data: user });
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const user = await userService.create(req.body, req.user._id);
    return success(res, { statusCode: 201, message: 'User created successfully', data: user });
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const user = await userService.update(req.params.id, req.body);
    return success(res, { statusCode: 200, message: 'User updated successfully', data: user });
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    await userService.remove(req.params.id);
    return success(res, { statusCode: 200, message: 'User deleted successfully' });
  } catch (err) { next(err); }
};

const updateStatus = async (req, res, next) => {
  try {
    const user = await userService.updateStatus(req.params.id, req.body.status);
    return success(res, { statusCode: 200, message: 'User status updated', data: user });
  } catch (err) { next(err); }
};

const getDevelopers = async (req, res, next) => {
  try {
    const users = await userService.getByRole('DEVELOPER');
    return success(res, { statusCode: 200, message: 'Developers fetched', data: users });
  } catch (err) { next(err); }
};

const getTeamLeads = async (req, res, next) => {
  try {
    const users = await userService.getByRole('TEAM_LEAD');
    return success(res, { statusCode: 200, message: 'Team leads fetched', data: users });
  } catch (err) { next(err); }
};

module.exports = { list, getById, create, update, remove, updateStatus, getDevelopers, getTeamLeads };
