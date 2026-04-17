const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requireRole , requireOrgAccess } = require('../middleware/roleGuard');
const {
  createBooking, getBookings, getBookingById, checkIn, checkOut, cancelBooking
} = require('../controllers/bookingController');

router.post('/', authenticate, requireOrgAccess, requireRole('OWNER', 'EMPLOYEE', 'SUPER_ADMIN'), createBooking);
router.get('/', authenticate, requireOrgAccess, getBookings);
router.get('/:id', authenticate, requireOrgAccess, getBookingById);
router.patch('/:id/checkin', authenticate, requireOrgAccess, requireRole('OWNER', 'EMPLOYEE', 'SUPER_ADMIN'), checkIn);
router.patch('/:id/checkout', authenticate, requireOrgAccess, requireRole('OWNER', 'EMPLOYEE', 'SUPER_ADMIN'), checkOut);
router.patch('/:id/cancel', authenticate, requireOrgAccess, requireRole('OWNER', 'EMPLOYEE', 'SUPER_ADMIN'), cancelBooking);

module.exports = router;
