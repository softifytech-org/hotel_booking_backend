/**
 * Action-Based API Routes
 * Clean, professional endpoint naming convention
 * Mounted at /api in server.js
 *
 * Naming pattern:
 *   Create  → POST   /api/createEntity
 *   Fetch   → GET    /api/fetchEntities  |  /api/fetchEntity/:id
 *   Update  → PUT    /api/updateEntity/:id
 *   Delete  → DELETE /api/deleteEntity/:id
 *   Action  → PATCH  /api/actionEntity/:id
 */
const router = require('express').Router();

// ─── Middleware ────────────────────────────────────────────
const { authenticate } = require('../middleware/auth');
const { requireRole, requireOrgAccess } = require('../middleware/roleGuard');
const {
  validateCreateOrganization,
  validateUpdateOrganization,
  validateCreateHotel,
  validateUpdateHotel,
  validateCreateRoom,
  validateUpdateRoom,
  validateCreateBooking,
  validateCreatePayment,
  validateCreateCustomer
} = require('../middleware/validators');

// ─── Controllers ──────────────────────────────────────────
const orgCtrl     = require('../controllers/organizationController');
const hotelCtrl   = require('../controllers/hotelController');
const roomCtrl    = require('../controllers/roomController');
const bookingCtrl = require('../controllers/bookingController');
const paymentCtrl = require('../controllers/paymentController');
const userCtrl    = require('../controllers/userController');
const customerCtrl = require('../controllers/customerController');

// ═══════════════════════════════════════════════════════════
//  ORGANIZATION ENDPOINTS
// ═══════════════════════════════════════════════════════════
router.post('/createOrganization',
  authenticate,
  requireRole('SUPER_ADMIN'),
  validateCreateOrganization,
  orgCtrl.createOrganization
);

router.get('/fetchOrganizations',
  authenticate,
  orgCtrl.getOrganizations
);

router.get('/fetchOrganization/:id',
  authenticate,
  orgCtrl.getOrganizationById
);

router.put('/updateOrganization/:id',
  authenticate,
  validateUpdateOrganization,
  orgCtrl.updateOrganization
);

// ═══════════════════════════════════════════════════════════
//  HOTEL ENDPOINTS
// ═══════════════════════════════════════════════════════════
router.post('/createHotel',
  authenticate,
  requireOrgAccess,
  requireRole('OWNER', 'SUPER_ADMIN'),
  validateCreateHotel,
  hotelCtrl.createOrganizationHotel
);

router.get('/fetchHotels',
  authenticate,
  requireOrgAccess,
  hotelCtrl.getOrganizationHotels
);

router.get('/fetchHotel/:id',
  authenticate,
  requireOrgAccess,
  hotelCtrl.getOrganizationHotelById
);

router.put('/updateHotel/:id',
  authenticate,
  requireOrgAccess,
  requireRole('OWNER', 'SUPER_ADMIN'),
  validateUpdateHotel,
  hotelCtrl.updateOrganizationHotel
);

router.delete('/deleteHotel/:id',
  authenticate,
  requireOrgAccess,
  requireRole('OWNER', 'SUPER_ADMIN'),
  hotelCtrl.deleteOrganizationHotel
);

// ═══════════════════════════════════════════════════════════
//  ROOM ENDPOINTS
// ═══════════════════════════════════════════════════════════
router.post('/createRoom',
  authenticate,
  requireOrgAccess,
  requireRole('OWNER', 'SUPER_ADMIN'),
  validateCreateRoom,
  roomCtrl.createHotelRoom
);

router.get('/fetchRooms',
  authenticate,
  requireOrgAccess,
  roomCtrl.getHotelRooms
);

router.get('/fetchRoom/:id',
  authenticate,
  requireOrgAccess,
  roomCtrl.getHotelRoomById
);

router.get('/checkRoomAvailability/:id',
  authenticate,
  requireOrgAccess,
  roomCtrl.checkHotelRoomAvailability
);

router.put('/updateRoom/:id',
  authenticate,
  requireOrgAccess,
  requireRole('OWNER', 'SUPER_ADMIN'),
  validateUpdateRoom,
  roomCtrl.updateHotelRoom
);

router.delete('/deleteRoom/:id',
  authenticate,
  requireOrgAccess,
  requireRole('OWNER', 'SUPER_ADMIN'),
  roomCtrl.deleteHotelRoom
);

// ═══════════════════════════════════════════════════════════
//  BOOKING ENDPOINTS
// ═══════════════════════════════════════════════════════════
router.post('/createBooking',
  authenticate,
  requireOrgAccess,
  requireRole('OWNER', 'EMPLOYEE', 'SUPER_ADMIN'),
  validateCreateBooking,
  bookingCtrl.createBooking
);

router.get('/fetchBookings',
  authenticate,
  requireOrgAccess,
  bookingCtrl.getBookings
);

router.get('/fetchBooking/:id',
  authenticate,
  requireOrgAccess,
  bookingCtrl.getBookingById
);

router.patch('/checkInBooking/:id',
  authenticate,
  requireOrgAccess,
  requireRole('OWNER', 'EMPLOYEE', 'SUPER_ADMIN'),
  bookingCtrl.checkInBooking
);

router.patch('/checkOutBooking/:id',
  authenticate,
  requireOrgAccess,
  requireRole('OWNER', 'EMPLOYEE', 'SUPER_ADMIN'),
  bookingCtrl.checkOutBooking
);

router.patch('/cancelBooking/:id',
  authenticate,
  requireOrgAccess,
  requireRole('OWNER', 'EMPLOYEE', 'SUPER_ADMIN'),
  bookingCtrl.cancelBooking
);

// ═══════════════════════════════════════════════════════════
//  PAYMENT ENDPOINTS
// ═══════════════════════════════════════════════════════════
router.post('/createPayment',
  authenticate,
  requireOrgAccess,
  validateCreatePayment,
  paymentCtrl.createBookingPayment
);

router.get('/fetchPayments',
  authenticate,
  requireOrgAccess,
  paymentCtrl.getPayments
);

router.patch('/refundPayment/:id',
  authenticate,
  requireOrgAccess,
  paymentCtrl.refundBookingPayment
);

// ═══════════════════════════════════════════════════════════
//  USER ENDPOINTS
// ═══════════════════════════════════════════════════════════
router.post('/createUser',
  authenticate,
  requireRole('OWNER', 'SUPER_ADMIN'),
  userCtrl.createUser
);

router.get('/fetchUsers',
  authenticate,
  userCtrl.getUsers
);

router.get('/fetchUser/:id',
  authenticate,
  userCtrl.getUserById
);

router.put('/updateUser/:id',
  authenticate,
  requireRole('OWNER', 'SUPER_ADMIN'),
  userCtrl.updateUser
);

router.delete('/deleteUser/:id',
  authenticate,
  requireRole('OWNER', 'SUPER_ADMIN'),
  userCtrl.deleteUser
);

// ═══════════════════════════════════════════════════════════
//  CUSTOMER ENDPOINTS
// ═══════════════════════════════════════════════════════════
router.post('/createCustomer',
  authenticate,
  requireOrgAccess,
  validateCreateCustomer,
  customerCtrl.createOrGetCustomer
);

router.get('/fetchCustomers',
  authenticate,
  requireOrgAccess,
  customerCtrl.getCustomers
);

router.get('/fetchCustomer/:id',
  authenticate,
  requireOrgAccess,
  customerCtrl.getCustomerById
);

module.exports = router;
