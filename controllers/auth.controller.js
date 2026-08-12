
const {
  register,
  login,
  getMe,
  changePassword
} = require('../services/auth.service');

const { success } = require('../utils/response');
const jwtConfig = require('../config/jwt');

const registerController = async (req, res, next) => {
  try {
    const { token, user } = await register(req.body);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: jwtConfig.cookieExpiresIn * 24 * 60 * 60 * 1000
    });

    return success(res, {
      statusCode: 201,
      message: 'Registration successful',
      data: {
        token,
        user
      }
    });
  } catch (err) {
    next(err);
  }
};

const loginController = async (req, res, next) => {
  try {
    const { token, user } = await login(
      req.body.email,
      req.body.password
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: jwtConfig.cookieExpiresIn * 24 * 60 * 60 * 1000
    });

    return success(res, {
      statusCode: 200,
      message: 'Login successful',
      data: {
        token,
        user
      }
    });
  } catch (err) {
    next(err);
  }
};

const logoutController = (req, res) => {
  res.clearCookie('token');

  return success(res, {
    statusCode: 200,
    message: 'Logged out successfully'
  });
};

const getMeController = async (req, res, next) => {
  try {
    const user = await getMe(req.user._id);

    return success(res, {
      statusCode: 200,
      message: 'User fetched',
      data: user
    });
  } catch (err) {
    next(err);
  }
};

const changePasswordController = async (req, res, next) => {
  try {
    await changePassword(
      req.user._id,
      req.body.currentPassword,
      req.body.newPassword
    );

    return success(res, {
      statusCode: 200,
      message: 'Password changed successfully'
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  registerController,
  loginController,
  logoutController,
  getMeController,
  changePasswordController
};
// const { login, getMe, changePassword } = require('../services/auth.service');
// const { success } = require('../utils/response');
// const jwtConfig = require('../config/jwt');

// const loginController = async (req, res, next) => {
//   try {
//     const { token, user } = await login(req.body.email, req.body.password);
//     res.cookie('token', token, {
//       httpOnly: true,
//       secure: process.env.NODE_ENV === 'production',
//       sameSite: 'strict',
//       maxAge: jwtConfig.cookieExpiresIn * 24 * 60 * 60 * 1000,
//     });
//     return success(res, { statusCode: 200, message: 'Login successful', data: { token, user } });
//   } catch (err) { next(err); }
// };

// const logoutController = (req, res) => {
//   res.clearCookie('token');
//   return success(res, { statusCode: 200, message: 'Logged out successfully' });
// };

// const getMeController = async (req, res, next) => {
//   try {
//     const user = await getMe(req.user._id);
//     return success(res, { statusCode: 200, message: 'User fetched', data: user });
//   } catch (err) { next(err); }
// };

// const changePasswordController = async (req, res, next) => {
//   try {
//     await changePassword(req.user._id, req.body.currentPassword, req.body.newPassword);
//     return success(res, { statusCode: 200, message: 'Password changed successfully' });
//   } catch (err) { next(err); }
// };

// module.exports = { loginController, logoutController, getMeController, changePasswordController };
