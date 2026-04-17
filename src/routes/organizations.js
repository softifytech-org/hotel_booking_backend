const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requireRole  } = require('../middleware/roleGuard');
const {
  createOrganization, getOrganizations, getOrganizationById, updateOrganization
} = require('../controllers/organizationController');

router.post('/', authenticate, requireRole('SUPER_ADMIN'), createOrganization);
router.get('/', authenticate, getOrganizations);
router.get('/:id', authenticate, getOrganizationById);
router.put('/:id', authenticate, updateOrganization);

module.exports = router;
