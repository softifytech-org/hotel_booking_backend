const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requireRole, requireOrgAccess } = require('../middleware/roleGuard');
const {
  createOrganizationHotel,
  getOrganizationHotels,
  getOrganizationHotelById,
  updateOrganizationHotel,
  deleteOrganizationHotel
} = require('../controllers/hotelController');

// Legacy REST endpoints (backward compatible with frontend)
router.post('/', authenticate, requireOrgAccess, requireRole('OWNER', 'SUPER_ADMIN'), createOrganizationHotel);
router.get('/', authenticate, requireOrgAccess, getOrganizationHotels);
router.get('/:id', authenticate, requireOrgAccess, getOrganizationHotelById);
router.put('/:id', authenticate, requireOrgAccess, requireRole('OWNER', 'SUPER_ADMIN'), updateOrganizationHotel);
router.delete('/:id', authenticate, requireOrgAccess, requireRole('OWNER', 'SUPER_ADMIN'), deleteOrganizationHotel);

module.exports = router;
