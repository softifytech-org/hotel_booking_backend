const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requireRole, requireOrgAccess } = require('../middleware/roleGuard');
const {
  createBooking,
  getBookings,
  getBookingById,
  checkInBooking,
  checkOutBooking,
  cancelBooking
} = require('../controllers/bookingController');

// Legacy REST endpoints (backward compatible with frontend)
router.post('/', authenticate, requireOrgAccess, requireRole('OWNER', 'EMPLOYEE', 'SUPER_ADMIN'), createBooking);
router.get('/', authenticate, requireOrgAccess, getBookings);
router.get('/:id', authenticate, requireOrgAccess, getBookingById);
router.patch('/:id/checkin', authenticate, requireOrgAccess, requireRole('OWNER', 'EMPLOYEE', 'SUPER_ADMIN'), checkInBooking);
router.patch('/:id/checkout', authenticate, requireOrgAccess, requireRole('OWNER', 'EMPLOYEE', 'SUPER_ADMIN'), checkOutBooking);
router.patch('/:id/cancel', authenticate, requireOrgAccess, requireRole('OWNER', 'EMPLOYEE', 'SUPER_ADMIN'), cancelBooking);

module.exports = router;
