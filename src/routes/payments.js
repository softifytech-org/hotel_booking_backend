const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requireOrgAccess } = require('../middleware/roleGuard');
const { createPayment, getPayments, refundPayment } = require('../controllers/paymentController');

router.post('/', authenticate, requireOrgAccess, createPayment);
router.get('/', authenticate, requireOrgAccess, getPayments);
router.patch('/:id/refund', authenticate, requireOrgAccess, refundPayment);

module.exports = router;
