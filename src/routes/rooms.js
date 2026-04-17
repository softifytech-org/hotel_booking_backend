const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requireRole , requireOrgAccess } = require('../middleware/roleGuard');
const {
  createRoom, getRooms, getRoomById, updateRoom, deleteRoom, checkAvailability
} = require('../controllers/roomController');

router.post('/', authenticate, requireOrgAccess, requireRole('OWNER', 'SUPER_ADMIN'), createRoom);
router.get('/', authenticate, requireOrgAccess, getRooms);
router.get('/:id', authenticate, requireOrgAccess, getRoomById);
router.get('/:id/availability', authenticate, requireOrgAccess, checkAvailability);
router.put('/:id', authenticate, requireOrgAccess, requireRole('OWNER', 'SUPER_ADMIN'), updateRoom);
router.delete('/:id', authenticate, requireOrgAccess, requireRole('OWNER', 'SUPER_ADMIN'), deleteRoom);

module.exports = router;
