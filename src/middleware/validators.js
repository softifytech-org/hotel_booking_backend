/**
 * Centralized Request Validation Middleware
 * Uses express-validator for route-level validation
 * Applied as middleware arrays in route definitions
 */
const { body, validationResult } = require('express-validator');

// ─────────────────────────────────────────────
//  Shared: Validation Error Handler
// ─────────────────────────────────────────────
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  }
  next();
};

// ─────────────────────────────────────────────
//  Organization — Create
// ─────────────────────────────────────────────
const validateCreateOrganization = [
  body('name')
    .trim()
    .notEmpty().withMessage('Organization name is required')
    .isLength({ min: 2, max: 255 }).withMessage('Name must be 2–255 characters'),
  body('code')
    .trim()
    .notEmpty().withMessage('Organization code is required')
    .matches(/^[A-Z0-9]{3}$/i).withMessage('Code must be exactly 3 alphanumeric characters'),
  body('ownerName')
    .trim()
    .notEmpty().withMessage('Owner name is required'),
  body('ownerEmail')
    .trim()
    .notEmpty().withMessage('Owner email is required')
    .isEmail().withMessage('Invalid email format'),
  body('ownerPassword')
    .notEmpty().withMessage('Owner password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('banner_images')
    .optional()
    .isArray().withMessage('banner_images must be an array'),
  body('banner_images.*')
    .optional()
    .isURL().withMessage('Each banner image must be a valid URL'),
  handleValidationErrors
];

// ─────────────────────────────────────────────
//  Organization — Update
// ─────────────────────────────────────────────
const validateUpdateOrganization = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 255 }).withMessage('Name must be 2–255 characters'),
  body('status')
    .optional()
    .isIn(['Active', 'Inactive', 'Suspended']).withMessage('Status must be Active, Inactive, or Suspended'),
  body('banner_images')
    .optional()
    .isArray().withMessage('banner_images must be an array'),
  body('banner_images.*')
    .optional()
    .isURL().withMessage('Each banner image must be a valid URL'),
  handleValidationErrors
];

// ─────────────────────────────────────────────
//  Hotel — Create
// ─────────────────────────────────────────────
const validateCreateHotel = [
  body('name')
    .trim()
    .notEmpty().withMessage('Hotel name is required')
    .isLength({ min: 2, max: 255 }).withMessage('Hotel name must be 2–255 characters'),
  body('city')
    .trim()
    .notEmpty().withMessage('City is required')
    .isLength({ min: 2, max: 100 }).withMessage('City must be 2–100 characters'),
  body('state')
    .trim()
    .notEmpty().withMessage('State is required')
    .isLength({ min: 2, max: 100 }).withMessage('State must be 2–100 characters'),
  body('email')
    .optional()
    .isEmail().withMessage('Invalid hotel email format'),
  handleValidationErrors
];

// ─────────────────────────────────────────────
//  Hotel — Update
// ─────────────────────────────────────────────
const validateUpdateHotel = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 255 }).withMessage('Hotel name must be 2–255 characters'),
  body('city')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('City must be 2–100 characters'),
  body('state')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('State must be 2–100 characters'),
  body('email')
    .optional()
    .isEmail().withMessage('Invalid hotel email format'),
  handleValidationErrors
];

// ─────────────────────────────────────────────
//  Room — Create
// ─────────────────────────────────────────────
const validateCreateRoom = [
  body('hotel_id')
    .notEmpty().withMessage('hotel_id is required'),
  body('room_number')
    .trim()
    .notEmpty().withMessage('Room number is required'),
  body('price')
    .notEmpty().withMessage('Price is required')
    .isFloat({ min: 0.01 }).withMessage('Price must be a positive number'),
  body('max_guests')
    .notEmpty().withMessage('max_guests is required')
    .isInt({ min: 1 }).withMessage('max_guests must be at least 1'),
  handleValidationErrors
];

// ─────────────────────────────────────────────
//  Room — Update
// ─────────────────────────────────────────────
const validateUpdateRoom = [
  body('price')
    .optional()
    .isFloat({ min: 0.01 }).withMessage('Price must be a positive number'),
  body('max_guests')
    .optional()
    .isInt({ min: 1 }).withMessage('max_guests must be at least 1'),
  handleValidationErrors
];

// ─────────────────────────────────────────────
//  Booking — Create
// ─────────────────────────────────────────────
const validateCreateBooking = [
  body('room_id')
    .notEmpty().withMessage('room_id is required'),
  body('customer_id')
    .notEmpty().withMessage('customer_id is required'),
  body('check_in')
    .notEmpty().withMessage('check_in date is required')
    .isISO8601().withMessage('check_in must be a valid date (YYYY-MM-DD)'),
  body('check_out')
    .notEmpty().withMessage('check_out date is required')
    .isISO8601().withMessage('check_out must be a valid date (YYYY-MM-DD)'),
  handleValidationErrors
];

// ─────────────────────────────────────────────
//  Payment — Create
// ─────────────────────────────────────────────
const validateCreatePayment = [
  body('booking_id')
    .notEmpty().withMessage('booking_id is required'),
  body('amount')
    .notEmpty().withMessage('Amount is required')
    .isFloat({ min: 0.01 }).withMessage('Amount must be a positive number'),
  body('method')
    .optional()
    .isIn(['CASH', 'CARD', 'BANK_TRANSFER', 'UPI', 'OTHER']).withMessage('Invalid payment method'),
  handleValidationErrors
];

// ─────────────────────────────────────────────
//  Customer — Create
// ─────────────────────────────────────────────
const validateCreateCustomer = [
  body('name')
    .trim()
    .notEmpty().withMessage('Customer name is required'),
  body('email')
    .trim()
    .notEmpty().withMessage('Customer email is required')
    .isEmail().withMessage('Invalid email format'),
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  validateCreateOrganization,
  validateUpdateOrganization,
  validateCreateHotel,
  validateUpdateHotel,
  validateCreateRoom,
  validateUpdateRoom,
  validateCreateBooking,
  validateCreatePayment,
  validateCreateCustomer
};
