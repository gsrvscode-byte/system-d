const { body, query } = require('express-validator');

const create = [
  body('title').trim().isLength({ min: 3 }).withMessage('Title must be at least 3 characters'),
  body('description').optional().trim(),
  body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).withMessage('Invalid priority'),
  body('status').optional().isIn(['PENDING', 'IN_PROGRESS', 'COMPLETED']).withMessage('Invalid status'),
  
  // Legacy field for backward compatibility - allow null/empty
  body('assignedTo')
    .optional()
    .custom((value) => {
      // Allow null, undefined, empty string, or empty array
      if (value === null || value === '' || value === undefined || (Array.isArray(value) && value.length === 0)) return true;
      // Validate as MongoId if a value is provided
      if (!/^[0-9a-fA-F]{24}$/.test(value)) throw new Error('Invalid assignedTo ID');
      return true;
    }),
  
  // New assignment fields
  body('assignmentType').optional().isIn(['DIRECT_DEVELOPER', 'TEAM_LEAD']).withMessage('Invalid assignment type'),
  body('teamLead')
    .optional()
    .custom((value) => {
      if (value === null || value === '' || value === undefined) return true;
      if (!/^[0-9a-fA-F]{24}$/.test(value)) throw new Error('Invalid team lead ID');
      return true;
    }),
  body('assignedDevelopers')
    .optional()
    .custom((value) => {
      if (value === null || value === undefined) return true;
      if (!Array.isArray(value)) throw new Error('Assigned developers must be an array');
      return true;
    }),
  body('assignedDevelopers.*')
    .optional()
    .custom((value) => {
      if (value === null || value === '' || value === undefined) return true;
      if (!/^[0-9a-fA-F]{24}$/.test(value)) throw new Error('Invalid developer ID');
      return true;
    }),
  body('currentOwner')
    .optional()
    .custom((value) => {
      if (value === null || value === '' || value === undefined) return true;
      if (!/^[0-9a-fA-F]{24}$/.test(value)) throw new Error('Invalid current owner ID');
      return true;
    }),
  
  body('dueDate')
    .optional()
    .isISO8601().withMessage('Invalid date format')
    .custom((value) => {
      if (value) {
        const dueDate = new Date(value);
        const today = new Date();
        // Reset today to start of day for comparison
        today.setHours(0, 0, 0, 0);
        // Reset dueDate to start of day for comparison
        dueDate.setHours(0, 0, 0, 0);
        
        if (dueDate < today) {
          throw new Error('Due date cannot be in the past');
        }
      }
      return true;
    }),
  body('estimatedHours').optional().isFloat({ min: 0 }).toFloat(),
  body('tags').optional().isArray(),
];

const update = [
  body('title').optional().trim().isLength({ min: 3 }).withMessage('Title must be at least 3 characters'),
  body('description').optional().trim(),
  body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).withMessage('Invalid priority'),
  body('status').optional().isIn(['PENDING', 'IN_PROGRESS', 'COMPLETED']).withMessage('Invalid status'),
  
  // Legacy field for backward compatibility - allow null/empty
  body('assignedTo')
    .optional()
    .custom((value) => {
      // Allow null, undefined, empty string, or empty array
      if (value === null || value === '' || value === undefined || (Array.isArray(value) && value.length === 0)) return true;
      // Validate as MongoId if a value is provided
      if (!/^[0-9a-fA-F]{24}$/.test(value)) throw new Error('Invalid assignedTo ID');
      return true;
    }),
  
  // New assignment fields
  body('assignmentType').optional().isIn(['DIRECT_DEVELOPER', 'TEAM_LEAD']).withMessage('Invalid assignment type'),
  body('teamLead')
    .optional()
    .custom((value) => {
      if (value === null || value === '' || value === undefined) return true;
      if (!/^[0-9a-fA-F]{24}$/.test(value)) throw new Error('Invalid team lead ID');
      return true;
    }),
  body('assignedDevelopers')
    .optional()
    .custom((value) => {
      if (value === null || value === undefined) return true;
      if (!Array.isArray(value)) throw new Error('Assigned developers must be an array');
      return true;
    }),
  body('assignedDevelopers.*')
    .optional()
    .custom((value) => {
      if (value === null || value === '' || value === undefined) return true;
      if (!/^[0-9a-fA-F]{24}$/.test(value)) throw new Error('Invalid developer ID');
      return true;
    }),
  body('currentOwner')
    .optional()
    .custom((value) => {
      if (value === null || value === '' || value === undefined) return true;
      if (!/^[0-9a-fA-F]{24}$/.test(value)) throw new Error('Invalid current owner ID');
      return true;
    }),
  
  body('dueDate')
    .optional()
    .isISO8601().withMessage('Invalid date format')
    .custom((value) => {
      if (value) {
        const dueDate = new Date(value);
        const today = new Date();
        // Reset today to start of day for comparison
        today.setHours(0, 0, 0, 0);
        // Reset dueDate to start of day for comparison
        dueDate.setHours(0, 0, 0, 0);
        
        if (dueDate < today) {
          throw new Error('Due date cannot be in the past');
        }
      }
      return true;
    }),
  body('estimatedHours').optional().isFloat({ min: 0 }).toFloat(),
  body('tags').optional().isArray(),
];

const updateStatus = [
  body('status').isIn(['PENDING', 'IN_PROGRESS', 'COMPLETED']).withMessage('Invalid status'),
];

const assign = [
  body('assignedTo').isMongoId().withMessage('Invalid user ID'),
];

const list = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('status').optional().isIn(['PENDING', 'IN_PROGRESS', 'COMPLETED']),
  query('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  query('assignedTo').optional().isMongoId(),
  query('teamLead').optional().isMongoId(),
  query('search').optional().trim(),
  query('sortBy').optional().isIn(['createdAt', 'dueDate', 'priority', 'status', 'title']),
  query('sortOrder').optional().isIn(['asc', 'desc']),
];

const comment = [
  body('comment').trim().isLength({ min: 1, max: 1000 }).withMessage('Comment must be 1-1000 characters'),
];

module.exports = { create, update, updateStatus, assign, list, comment };
