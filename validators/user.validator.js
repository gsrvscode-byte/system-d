const { body, query } = require('express-validator');

const create = [
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('email').isEmail().withMessage('Please provide a valid email').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').optional().isIn(['ADMIN', 'TEAM_LEAD', 'DEVELOPER']).withMessage('Invalid role'),
  body('phone').optional().trim(),
  body('teamLead').optional().isMongoId().withMessage('Invalid team lead ID'),
];

const update = [
  body('name').optional().trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('email').optional().isEmail().withMessage('Please provide a valid email').normalizeEmail(),
  body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').optional().isIn(['ADMIN', 'TEAM_LEAD', 'DEVELOPER']).withMessage('Invalid role'),
  body('phone').optional().trim(),
  body('teamLead').optional().isMongoId().withMessage('Invalid team lead ID'),
];

const updateStatus = [
  body('status').isIn(['ACTIVE', 'INACTIVE']).withMessage('Status must be ACTIVE or INACTIVE'),
];

const list = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('role').optional().isIn(['ADMIN', 'TEAM_LEAD', 'DEVELOPER']),
  query('status').optional().isIn(['ACTIVE', 'INACTIVE']),
];

module.exports = { create, update, updateStatus, list };
