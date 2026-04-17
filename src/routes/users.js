const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleGuard');
const { createUser, getUsers, getUserById, updateUser, deleteUser } = require('../controllers/userController');

router.post('/', authenticate, requireRole('OWNER', 'SUPER_ADMIN'), createUser);
router.get('/', authenticate, getUsers);
router.get('/:id', authenticate, getUserById);
router.put('/:id', authenticate, requireRole('OWNER', 'SUPER_ADMIN'), updateUser);
router.delete('/:id', authenticate, requireRole('OWNER', 'SUPER_ADMIN'), deleteUser);

module.exports = router;
