const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requireRole , requireOrgAccess } = require('../middleware/roleGuard');
const { createHotel, getHotels, getHotelById, updateHotel, deleteHotel } = require('../controllers/hotelController');

router.post('/', authenticate, requireOrgAccess, requireRole('OWNER', 'SUPER_ADMIN'), createHotel);
router.get('/', authenticate, requireOrgAccess, getHotels);
router.get('/:id', authenticate, requireOrgAccess, getHotelById);
router.put('/:id', authenticate, requireOrgAccess, requireRole('OWNER', 'SUPER_ADMIN'), updateHotel);
router.delete('/:id', authenticate, requireOrgAccess, requireRole('OWNER', 'SUPER_ADMIN'), deleteHotel);

module.exports = router;
