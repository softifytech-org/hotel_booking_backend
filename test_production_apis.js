/**
 * Hotel SaaS Backend — End-to-End API Test Suite
 * Tests all create + fetch APIs with the new action-based endpoints
 *
 * Usage: node test_production_apis.js
 *
 * Prerequisites:
 *   1. Server running on http://localhost:5000
 *   2. Migration v4 applied (city, state, banner_images columns)
 *   3. Super admin account: admin@saas.com / admin123
 */

const http = require('http');
const https = require('https');

const BASE_URL = 'http://localhost:5000';
let AUTH_TOKEN = '';
let testOrgId = null;
let testOwnerId = null;
let testOwnerToken = '';
let testHotelId = null;
let testRoomId = null;
let testCustomerId = null;
let testBookingId = null;
let testPaymentId = null;

const PASS = '✅';
const FAIL = '❌';
const SKIP = '⏭️';
let passed = 0;
let failed = 0;
let skipped = 0;

// ─── HTTP Request Helper ──────────────────────────────────
function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// ─── Test Runner ──────────────────────────────────────────
async function test(name, fn) {
  try {
    await fn();
    console.log(`  ${PASS} ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ${FAIL} ${name}`);
    console.log(`     Error: ${err.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// ─── Test Suites ──────────────────────────────────────────

async function testHealthCheck() {
  console.log('\n━━━ Health Check ━━━');
  await test('GET /health returns 200', async () => {
    const res = await request('GET', '/health');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.success === true, 'Expected success: true');
  });
}

async function testAuth() {
  console.log('\n━━━ Authentication ━━━');

  await test('POST /api/auth/login — Super Admin login', async () => {
    const res = await request('POST', '/api/auth/login', {
      email: 'admin@saas.com',
      password: 'admin123'
    });
    assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(res.body.success === true, 'Expected success');
    assert(res.body.data.user.role === 'SUPER_ADMIN', 'Expected SUPER_ADMIN role');
    AUTH_TOKEN = res.body.data.accessToken;
  });
}

async function testOrganizations() {
  console.log('\n━━━ Organizations ━━━');

  const orgCode = 'T' + Math.random().toString(36).substring(2, 4).toUpperCase();
  const ownerEmail = `owner_${Date.now()}@test.com`;

  await test('POST /api/createOrganization — with banner_images', async () => {
    const res = await request('POST', '/api/createOrganization', {
      name: 'Test Hotel Group',
      code: orgCode,
      website: 'https://testhotels.com',
      phone: '+91-9876543210',
      address: '123 Test Street, Hyderabad',
      banner_images: [
        'https://img1.example.com/banner1.jpg',
        'https://img2.example.com/banner2.jpg'
      ],
      ownerName: 'Test Owner',
      ownerEmail: ownerEmail,
      ownerPassword: 'TestPass123'
    }, AUTH_TOKEN);
    assert(res.status === 201, `Expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(res.body.success === true, 'Expected success');
    assert(res.body.data.organization, 'Expected organization in response');
    assert(res.body.data.owner, 'Expected owner in response');
    testOrgId = res.body.data.organization.id;
    testOwnerId = res.body.data.owner.id;

    // Verify banner_images stored
    const org = res.body.data.organization;
    assert(Array.isArray(org.banner_images), 'Expected banner_images array');
    assert(org.banner_images.length === 2, `Expected 2 banner images, got ${org.banner_images.length}`);
    assert(org.code === orgCode, `Expected code ${orgCode}, got ${org.code}`);
  });

  await test('POST /api/createOrganization — duplicate code rejected', async () => {
    const res = await request('POST', '/api/createOrganization', {
      name: 'Duplicate Org',
      code: orgCode,
      ownerName: 'Dup Owner',
      ownerEmail: `dup_${Date.now()}@test.com`,
      ownerPassword: 'Test123'
    }, AUTH_TOKEN);
    assert(res.status === 409, `Expected 409, got ${res.status}`);
  });

  await test('POST /api/createOrganization — invalid code rejected', async () => {
    const res = await request('POST', '/api/createOrganization', {
      name: 'Bad Code Org',
      code: 'TOOLONG',
      ownerName: 'Bad Owner',
      ownerEmail: `bad_${Date.now()}@test.com`,
      ownerPassword: 'Test123'
    }, AUTH_TOKEN);
    assert(res.status === 422 || res.status === 400, `Expected 422/400, got ${res.status}`);
  });

  await test('GET /api/getOrganizations — paginated list', async () => {
    const res = await request('GET', '/api/getOrganizations?page=1&limit=10', null, AUTH_TOKEN);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.success === true, 'Expected success');
    assert(Array.isArray(res.body.data), 'Expected data array');
    assert(res.body.pagination, 'Expected pagination metadata');
    assert(res.body.pagination.page === 1, 'Expected page 1');
    assert(typeof res.body.pagination.total_count === 'number', 'Expected total_count');
  });

  await test('GET /api/getOrganizations — search by name', async () => {
    const res = await request('GET', '/api/getOrganizations?search=Test Hotel', null, AUTH_TOKEN);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.data.length > 0, 'Expected at least one result');
  });

  await test('GET /api/getOrganization/:id — single org', async () => {
    const res = await request('GET', `/api/getOrganization/${testOrgId}`, null, AUTH_TOKEN);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.data.id == testOrgId, 'Expected matching org ID');
    assert(Array.isArray(res.body.data.banner_images), 'Expected banner_images in response');
  });

  await test('PUT /api/updateOrganization/:id — update banner_images', async () => {
    const res = await request('PUT', `/api/updateOrganization/${testOrgId}`, {
      banner_images: [
        'https://img1.example.com/new-banner.jpg'
      ]
    }, AUTH_TOKEN);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.data.banner_images.length === 1, 'Expected 1 banner image after update');
  });

  // Login as owner for subsequent tests
  await test('POST /api/auth/login — Owner login', async () => {
    const res = await request('POST', '/api/auth/login', {
      email: ownerEmail,
      password: 'TestPass123'
    });
    assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    testOwnerToken = res.body.data.accessToken;
  });
}

async function testHotels() {
  console.log('\n━━━ Hotels ━━━');

  await test('POST /api/createHotel — with city and state', async () => {
    const res = await request('POST', '/api/createHotel', {
      name: 'Taj Banjara',
      city: 'Hyderabad',
      state: 'Telangana',
      phone: '+91-40-66662323',
      email: 'info@tajbanjara.com',
      address: 'Road No. 1, Banjara Hills',
      organization_id: testOrgId
    }, testOwnerToken);
    assert(res.status === 201, `Expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(res.body.data.city === 'Hyderabad', 'Expected city Hyderabad');
    assert(res.body.data.state === 'Telangana', 'Expected state Telangana');
    testHotelId = res.body.data.id;
  });

  await test('POST /api/createHotel — missing city rejected', async () => {
    const res = await request('POST', '/api/createHotel', {
      name: 'No City Hotel',
      state: 'Some State',
      organization_id: testOrgId
    }, testOwnerToken);
    assert(res.status === 422 || res.status === 400, `Expected 422/400, got ${res.status}`);
  });

  await test('POST /api/createHotel — missing state rejected', async () => {
    const res = await request('POST', '/api/createHotel', {
      name: 'No State Hotel',
      city: 'Some City',
      organization_id: testOrgId
    }, testOwnerToken);
    assert(res.status === 422 || res.status === 400, `Expected 422/400, got ${res.status}`);
  });

  await test('GET /api/getHotels — list hotels', async () => {
    const res = await request('GET', '/api/getHotels', null, testOwnerToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.body.data), 'Expected data array');
    assert(res.body.pagination, 'Expected pagination');
  });

  await test('GET /api/getHotels — search by name', async () => {
    const res = await request('GET', '/api/getHotels?search=Taj', null, testOwnerToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.data.length > 0, 'Expected at least one result');
  });

  await test('GET /api/getHotels — filter by city', async () => {
    const res = await request('GET', '/api/getHotels?city=Hyderabad', null, testOwnerToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.data.length > 0, 'Expected at least one result');
  });

  await test('GET /api/getHotels — filter by state', async () => {
    const res = await request('GET', '/api/getHotels?state=Telangana', null, testOwnerToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.data.length > 0, 'Expected at least one result');
  });

  await test('GET /api/getHotel/:id — single hotel', async () => {
    const res = await request('GET', `/api/getHotel/${testHotelId}`, null, testOwnerToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.data.id == testHotelId, 'Expected matching hotel ID');
    assert(res.body.data.city === 'Hyderabad', 'Expected city in response');
    assert(res.body.data.state === 'Telangana', 'Expected state in response');
  });

  await test('PUT /api/updateHotel/:id — update city/state', async () => {
    const res = await request('PUT', `/api/updateHotel/${testHotelId}`, {
      city: 'Mumbai',
      state: 'Maharashtra',
      organization_id: testOrgId
    }, testOwnerToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.data.city === 'Mumbai', 'Expected updated city');
    assert(res.body.data.state === 'Maharashtra', 'Expected updated state');
  });
}

async function testRooms() {
  console.log('\n━━━ Rooms ━━━');

  await test('POST /api/createRoom — with max_guests', async () => {
    const res = await request('POST', '/api/createRoom', {
      hotel_id: testHotelId,
      room_number: '101',
      type: 'Deluxe',
      price: 5000,
      floor: '1',
      max_guests: 3,
      adults: 2,
      children: 1,
      amenities: ['WiFi', 'AC', 'TV'],
      organization_id: testOrgId
    }, testOwnerToken);
    assert(res.status === 201, `Expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(res.body.data.max_guests === 3, 'Expected max_guests 3');
    testRoomId = res.body.data.id;
  });

  await test('POST /api/createRoom — missing max_guests rejected', async () => {
    const res = await request('POST', '/api/createRoom', {
      hotel_id: testHotelId,
      room_number: '102',
      price: 3000,
      max_guests: 0,
      organization_id: testOrgId
    }, testOwnerToken);
    assert(res.status === 422 || res.status === 400, `Expected 422/400, got ${res.status}`);
  });

  await test('GET /api/getRooms — list rooms', async () => {
    const res = await request('GET', '/api/getRooms', null, testOwnerToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.body.data), 'Expected data array');
    assert(res.body.pagination, 'Expected pagination');
  });

  await test('GET /api/getRooms — filter by hotel_id', async () => {
    const res = await request('GET', `/api/getRooms?hotel_id=${testHotelId}`, null, testOwnerToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.data.length > 0, 'Expected at least one room');
  });

  await test('GET /api/getRooms — search by room number', async () => {
    const res = await request('GET', '/api/getRooms?search=101', null, testOwnerToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.data.length > 0, 'Expected at least one result');
  });

  await test('GET /api/getRooms — filter by type', async () => {
    const res = await request('GET', '/api/getRooms?type=Deluxe', null, testOwnerToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.data.length > 0, 'Expected at least one Deluxe room');
  });

  await test('GET /api/getRoom/:id — single room', async () => {
    const res = await request('GET', `/api/getRoom/${testRoomId}`, null, testOwnerToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.data.id == testRoomId, 'Expected matching room ID');
    assert(res.body.data.hotel_name, 'Expected hotel_name in response');
  });

  await test('GET /api/checkRoomAvailability/:id — check availability', async () => {
    const res = await request('GET', `/api/checkRoomAvailability/${testRoomId}?check_in=2026-06-01&check_out=2026-06-05`, null, testOwnerToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.data.available === true, 'Expected room to be available');
  });
}

async function testCustomersAndBookings() {
  console.log('\n━━━ Customers & Bookings ━━━');

  await test('POST /api/createCustomer — create guest', async () => {
    const res = await request('POST', '/api/createCustomer', {
      name: 'John Doe',
      email: `john_${Date.now()}@guest.com`,
      phone: '+91-9876543211'
    }, testOwnerToken);
    assert(res.status === 201, `Expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);
    testCustomerId = res.body.data.id;
  });

  await test('GET /api/getCustomers — list customers', async () => {
    const res = await request('GET', '/api/getCustomers', null, testOwnerToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.body.data), 'Expected data array');
  });

  await test('GET /api/getCustomer/:id — single customer', async () => {
    const res = await request('GET', `/api/getCustomer/${testCustomerId}`, null, testOwnerToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.data.id == testCustomerId, 'Expected matching customer ID');
  });

  await test('POST /api/createBooking — create booking', async () => {
    const res = await request('POST', '/api/createBooking', {
      room_id: testRoomId,
      customer_id: testCustomerId,
      check_in: '2026-07-01',
      check_out: '2026-07-05',
      notes: 'E2E test booking',
      organization_id: testOrgId
    }, testOwnerToken);
    assert(res.status === 201, `Expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(res.body.data.status === 'CONFIRMED', 'Expected CONFIRMED status');
    assert(res.body.data.guest_name === 'John Doe', 'Expected guest name');
    testBookingId = res.body.data.id;
  });

  await test('GET /api/getBookings — list bookings', async () => {
    const res = await request('GET', '/api/getBookings', null, testOwnerToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.body.data), 'Expected data array');
    assert(res.body.pagination, 'Expected pagination');
  });

  await test('GET /api/getBookings — filter by status', async () => {
    const res = await request('GET', '/api/getBookings?status=CONFIRMED', null, testOwnerToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.data.length > 0, 'Expected at least one confirmed booking');
  });

  await test('GET /api/getBookings — filter by hotel_id', async () => {
    const res = await request('GET', `/api/getBookings?hotel_id=${testHotelId}`, null, testOwnerToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.data.length > 0, 'Expected at least one booking for hotel');
  });

  await test('GET /api/getBookings — filter by customer_id', async () => {
    const res = await request('GET', `/api/getBookings?customer_id=${testCustomerId}`, null, testOwnerToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.data.length > 0, 'Expected at least one booking for customer');
  });

  await test('GET /api/getBooking/:id — single booking', async () => {
    const res = await request('GET', `/api/getBooking/${testBookingId}`, null, testOwnerToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.data.id == testBookingId, 'Expected matching booking ID');
    assert(res.body.data.hotel_name, 'Expected hotel_name in response');
    assert(res.body.data.room_number, 'Expected room_number in response');
  });
}

async function testPayments() {
  console.log('\n━━━ Payments ━━━');

  await test('POST /api/createPayment — create payment', async () => {
    const res = await request('POST', '/api/createPayment', {
      booking_id: testBookingId,
      amount: 20000,
      method: 'CARD',
      transaction_ref: 'TXN_TEST_001'
    }, testOwnerToken);
    assert(res.status === 201, `Expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(res.body.data.status === 'PAID', 'Expected PAID status');
    testPaymentId = res.body.data.id;
  });

  await test('GET /api/getPayments — list payments', async () => {
    const res = await request('GET', '/api/getPayments', null, testOwnerToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.body.data), 'Expected data array');
    assert(res.body.summary, 'Expected summary in response');
    assert(typeof res.body.summary.total_revenue === 'number', 'Expected total_revenue number');
    assert(res.body.pagination, 'Expected pagination');
  });

  await test('GET /api/getPayments — filter by booking_id', async () => {
    const res = await request('GET', `/api/getPayments?booking_id=${testBookingId}`, null, testOwnerToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.data.length > 0, 'Expected at least one payment for booking');
  });
}

async function testBookingLifecycle() {
  console.log('\n━━━ Booking Lifecycle ━━━');

  await test('PATCH /api/checkInBooking/:id — check in', async () => {
    const res = await request('PATCH', `/api/checkInBooking/${testBookingId}`, {}, testOwnerToken);
    assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(res.body.success === true, 'Expected success');
  });

  await test('GET /api/getBooking/:id — verify CHECKED_IN status', async () => {
    const res = await request('GET', `/api/getBooking/${testBookingId}`, null, testOwnerToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.data.status === 'CHECKED_IN', `Expected CHECKED_IN, got ${res.body.data.status}`);
  });

  await test('PATCH /api/checkOutBooking/:id — check out', async () => {
    const res = await request('PATCH', `/api/checkOutBooking/${testBookingId}`, {}, testOwnerToken);
    assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(res.body.success === true, 'Expected success');
  });

  await test('GET /api/getBooking/:id — verify CHECKED_OUT status', async () => {
    const res = await request('GET', `/api/getBooking/${testBookingId}`, null, testOwnerToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.data.status === 'CHECKED_OUT', `Expected CHECKED_OUT, got ${res.body.data.status}`);
  });
}

async function testLegacyRoutes() {
  console.log('\n━━━ Legacy REST Routes (Backward Compatibility) ━━━');

  await test('GET /api/organizations — legacy route still works', async () => {
    const res = await request('GET', '/api/organizations', null, AUTH_TOKEN);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.success === true, 'Expected success');
  });

  await test('GET /api/hotels — legacy route still works', async () => {
    const res = await request('GET', '/api/hotels', null, testOwnerToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.success === true, 'Expected success');
  });

  await test('GET /api/rooms — legacy route still works', async () => {
    const res = await request('GET', '/api/rooms', null, testOwnerToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.success === true, 'Expected success');
  });

  await test('GET /api/bookings — legacy route still works', async () => {
    const res = await request('GET', '/api/bookings', null, testOwnerToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.success === true, 'Expected success');
  });

  await test('GET /api/payments — legacy route still works', async () => {
    const res = await request('GET', '/api/payments', null, testOwnerToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.success === true, 'Expected success');
  });
}

async function testValidation() {
  console.log('\n━━━ Validation ━━━');

  await test('POST /api/createOrganization — empty body returns 422', async () => {
    const res = await request('POST', '/api/createOrganization', {}, AUTH_TOKEN);
    assert(res.status === 422 || res.status === 400, `Expected 422/400, got ${res.status}`);
  });

  await test('POST /api/createHotel — empty body returns 422', async () => {
    const res = await request('POST', '/api/createHotel', {
      organization_id: testOrgId
    }, testOwnerToken);
    assert(res.status === 422 || res.status === 400, `Expected 422/400, got ${res.status}`);
  });

  await test('POST /api/createRoom — missing price returns 422', async () => {
    const res = await request('POST', '/api/createRoom', {
      hotel_id: testHotelId,
      room_number: '999',
      organization_id: testOrgId
    }, testOwnerToken);
    assert(res.status === 422 || res.status === 400, `Expected 422/400, got ${res.status}`);
  });

  await test('Unauthenticated request returns 401', async () => {
    const res = await request('GET', '/api/getOrganizations');
    assert(res.status === 401, `Expected 401, got ${res.status}`);
  });
}

// ─── Main Runner ──────────────────────────────────────────
async function run() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  Hotel SaaS Backend — E2E API Test Suite     ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`\nTarget: ${BASE_URL}`);
  console.log(`Time:   ${new Date().toISOString()}\n`);

  try {
    await testHealthCheck();
    await testAuth();
    await testOrganizations();
    await testHotels();
    await testRooms();
    await testCustomersAndBookings();
    await testPayments();
    await testBookingLifecycle();
    await testLegacyRoutes();
    await testValidation();
  } catch (err) {
    console.log(`\n${FAIL} Fatal error: ${err.message}`);
    failed++;
  }

  // Summary
  console.log('\n══════════════════════════════════════════════');
  console.log(`  ${PASS} Passed:  ${passed}`);
  console.log(`  ${FAIL} Failed:  ${failed}`);
  console.log(`  ${SKIP} Skipped: ${skipped}`);
  console.log('══════════════════════════════════════════════');

  if (failed > 0) {
    console.log('\n⚠️  Some tests failed. Review errors above.\n');
    process.exit(1);
  } else {
    console.log('\n🎉 All tests passed! Backend is production-ready.\n');
    process.exit(0);
  }
}

run();
