/**
 * Input Validation Middleware
 *
 * Features:
 * - Express-validator based validation
 * - Reusable validation rules
 * - Sanitization
 * - Custom error messages
 *
 * Usage:
 * router.post('/users', validateUser, async (req, res) => { ... });
 */

const { body, param, query, validationResult } = require('express-validator');
const { ValidationError } = require('../utils/errors');

/**
 * Validation error handler
 * Throws ValidationError if there are validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(err => ({
      field: err.path || err.param,
      message: err.msg,
      value: err.value
    }));

    throw new ValidationError('Validation failed', formattedErrors);
  }

  next();
};

/**
 * Common validation rules
 */

// MongoDB ObjectId validation
const isValidObjectId = (value) => {
  return /^[0-9a-fA-F]{24}$/.test(value);
};

// User validation rules
const validateUser = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),

  body('pin')
    .notEmpty().withMessage('PIN is required')
    .isLength({ min: 4, max: 4 }).withMessage('PIN must be exactly 4 digits')
    .isNumeric().withMessage('PIN must contain only numbers'),

  body('role')
    .notEmpty().withMessage('Role is required')
    .isIn(['manager', 'detailer', 'salesperson']).withMessage('Invalid role'),

  body('phoneNumber')
    .optional()
    .trim()
    .matches(/^[\d\s\-\(\)\+]+$/).withMessage('Invalid phone number format'),

  handleValidationErrors
];

// Login validation rules
const validateLogin = [
  body('employeeId')
    .trim()
    .notEmpty().withMessage('Employee ID or PIN is required'),

  body('pin')
    .notEmpty().withMessage('PIN is required')
    .isLength({ min: 4, max: 4 }).withMessage('PIN must be exactly 4 digits'),

  handleValidationErrors
];

// Job creation validation rules
const validateJob = [
  body('vin')
    .trim()
    .notEmpty().withMessage('VIN is required')
    .isLength({ min: 17, max: 17 }).withMessage('VIN must be exactly 17 characters'),

  body('stockNumber')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('Stock number too long'),

  body('serviceType')
    .trim()
    .notEmpty().withMessage('Service type is required'),

  body('priority')
    .optional()
    .isIn(['Low', 'Normal', 'High', 'Urgent']).withMessage('Invalid priority'),

  body('make')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('Make too long'),

  body('model')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('Model too long'),

  body('year')
    .optional()
    .isInt({ min: 1900, max: 2100 }).withMessage('Invalid year'),

  handleValidationErrors
];

// Job ID param validation
const validateJobId = [
  param('id')
    .custom(isValidObjectId).withMessage('Invalid job ID format'),

  handleValidationErrors
];

// User ID param validation
const validateUserId = [
  param('id')
    .custom(isValidObjectId).withMessage('Invalid user ID format'),

  handleValidationErrors
];

// Settings update validation
const validateSettings = [
  body('siteTitle')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 }).withMessage('Site title must be between 1 and 100 characters'),

  body('inventoryCsvUrl')
    .optional()
    .trim()
    .isURL().withMessage('Invalid URL format'),

  handleValidationErrors
];

// Query parameter validation for pagination
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),

  handleValidationErrors
];

// Date range validation
const validateDateRange = [
  query('startDate')
    .optional()
    .isISO8601().withMessage('Invalid start date format'),

  query('endDate')
    .optional()
    .isISO8601().withMessage('Invalid end date format')
    .custom((endDate, { req }) => {
      if (req.query.startDate && new Date(endDate) < new Date(req.query.startDate)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),

  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  validateUser,
  validateLogin,
  validateJob,
  validateJobId,
  validateUserId,
  validateSettings,
  validatePagination,
  validateDateRange
};
