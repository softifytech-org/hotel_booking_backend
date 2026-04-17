const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requireOrgAccess } = require('../middleware/roleGuard');
const { createOrGetCustomer, getCustomers, getCustomerById } = require('../controllers/customerController');

router.post('/', authenticate, requireOrgAccess, createOrGetCustomer);
router.get('/', authenticate, requireOrgAccess, getCustomers);
router.get('/:id', authenticate, requireOrgAccess, getCustomerById);

module.exports = router;
