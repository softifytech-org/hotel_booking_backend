const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requireRole, requireOrgAccess } = require('../middleware/roleGuard');
const {
  createHotelRoom,
  getHotelRooms,
  getHotelRoomById,
  updateHotelRoom,
  deleteHotelRoom,
  checkHotelRoomAvailability
} = require('../controllers/roomController');

// Legacy REST endpoints (backward compatible with frontend)
router.post('/', authenticate, requireOrgAccess, requireRole('OWNER', 'SUPER_ADMIN'), createHotelRoom);
router.get('/', authenticate, requireOrgAccess, getHotelRooms);
router.get('/:id', authenticate, requireOrgAccess, getHotelRoomById);
router.get('/:id/availability', authenticate, requireOrgAccess, checkHotelRoomAvailability);
router.put('/:id', authenticate, requireOrgAccess, requireRole('OWNER', 'SUPER_ADMIN'), updateHotelRoom);
router.delete('/:id', authenticate, requireOrgAccess, requireRole('OWNER', 'SUPER_ADMIN'), deleteHotelRoom);

module.exports = router;
