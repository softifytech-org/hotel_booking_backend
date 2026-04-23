const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requireOrgAccess } = require('../middleware/roleGuard');
const { createBookingPayment, getPayments, refundBookingPayment } = require('../controllers/paymentController');

// Legacy REST endpoints (backward compatible with frontend)
router.post('/', authenticate, requireOrgAccess, createBookingPayment);
router.get('/', authenticate, requireOrgAccess, getPayments);
router.patch('/:id/refund', authenticate, requireOrgAccess, refundBookingPayment);

module.exports = router;
