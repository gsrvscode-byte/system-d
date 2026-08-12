const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const { getDashboardData } = require('../controllers/dashboard.controller');

const router = express.Router();

router.use(protect);
router.get('/', getDashboardData);

module.exports = router;
