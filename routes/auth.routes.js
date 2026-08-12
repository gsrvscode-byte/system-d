// const express = require('express');
// const { login, changePassword } = require('../validators/auth.validator');
// const { validate } = require('../middleware/validation.middleware');
// const { protect } = require('../middleware/auth.middleware');
// const { loginController, logoutController, getMeController, changePasswordController } = require('../controllers/auth.controller');

// const router = express.Router();

// router.post('/login', login, validate, loginController);
// router.post('/logout', protect, logoutController);
// router.get('/me', protect, getMeController);
// router.put('/change-password', protect, changePassword, validate, changePasswordController);

// module.exports = router;

const express = require('express');

const {
  registerController,
  loginController,
  logoutController,
  getMeController,
  changePasswordController
} = require('../controllers/auth.controller');

const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Public Routes
|--------------------------------------------------------------------------
*/

router.post('/register', registerController);
router.post('/login', loginController);

/*
|--------------------------------------------------------------------------
| Protected Routes
|--------------------------------------------------------------------------
*/

router.use(protect);

router.post('/logout', logoutController);
router.get('/me', getMeController);
router.patch('/change-password', changePasswordController);

module.exports = router;