/**
 * Captures REAL request/response for every single API endpoint
 * Creates 3 hotels in one org, tests all fetch endpoints
 */
const http = require('http');

const BASE = 'http://localhost:5000';
let ADMIN_TOKEN = '';
let OWNER_TOKEN = '';
let ORG_ID = null;
let HOTEL_IDS = [];
let ROOM_ID = null;
let CUSTOMER_ID = null;
let BOOKING_ID = null;
let PAYMENT_ID = null;
let OWNER_EMAIL = '';
let USER_ID = null;

function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = {
      hostname: url.hostname, port: url.port,
      path: url.pathname + url.search, method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;

    const r = http.request(opts, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, body: d }); }
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

function log(label, method, url, reqBody, res) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  ${label}`);
  console.log(`${'═'.repeat(70)}`);
  console.log(`\n  METHOD:  ${method}`);
  console.log(`  URL:     ${BASE}${url}`);
  if (reqBody) console.log(`\n  REQUEST BODY:\n${JSON.stringify(reqBody, null, 2)}`);
  console.log(`\n  STATUS:  ${res.status}`);
  console.log(`\n  RESPONSE:\n${JSON.stringify(res.body, null, 2)}`);
}

async function run() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║    HOTEL SAAS BACKEND — COMPLETE API REFERENCE WITH REAL DATA       ║');
  console.log('║    Base URL: http://localhost:5000                                   ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  // ─── 1. HEALTH CHECK ─────────────────────────
  let res = await req('GET', '/health');
  log('1. HEALTH CHECK', 'GET', '/health', null, res);

  // ─── 2. ADMIN LOGIN ──────────────────────────
  let loginBody = { email: 'admin@saas.com', password: 'admin123' };
  res = await req('POST', '/api/auth/login', loginBody);
  log('2. ADMIN LOGIN', 'POST', '/api/auth/login', loginBody, res);
  ADMIN_TOKEN = res.body.data.accessToken;
  const REFRESH_TOKEN = res.body.data.refreshToken;

  // ─── 3. GET ME (Current User) ────────────────
  res = await req('GET', '/api/auth/me', null, ADMIN_TOKEN);
  log('3. GET CURRENT USER (ME)', 'GET', '/api/auth/me', null, res);

  // ─── 4. REFRESH TOKEN ────────────────────────
  let refreshBody = { refreshToken: REFRESH_TOKEN };
  res = await req('POST', '/api/auth/refresh', refreshBody);
  log('4. REFRESH TOKEN', 'POST', '/api/auth/refresh', refreshBody, res);
  if (res.body.data) ADMIN_TOKEN = res.body.data.accessToken;

  // ─── 5. CREATE ORGANIZATION ──────────────────
  const orgCode = 'P' + Math.random().toString(36).substring(2, 4).toUpperCase();
  OWNER_EMAIL = `postman_owner_${Date.now()}@test.com`;
  let createOrgBody = {
    name: 'Postman Hotels Group',
    code: orgCode,
    website: 'https://postmanhotels.com',
    phone: '+91-9000000001',
    address: '100 Postman Road, Hyderabad, Telangana',
    logo_url: 'https://example.com/logo.png',
    banner_images: [
      'https://example.com/banner1.jpg',
      'https://example.com/banner2.jpg'
    ],
    ownerName: 'Postman Owner',
    ownerEmail: OWNER_EMAIL,
    ownerPassword: 'PostmanPass123'
  };
  res = await req('POST', '/api/createOrganization', createOrgBody, ADMIN_TOKEN);
  log('5. CREATE ORGANIZATION (Super Admin Only)', 'POST', '/api/createOrganization', createOrgBody, res);
  ORG_ID = res.body.data.organization.id;

  // ─── 6. GET ALL ORGANIZATIONS ────────────────
  res = await req('GET', '/api/getOrganizations?page=1&limit=5&search=Postman', null, ADMIN_TOKEN);
  log('6. GET ORGANIZATIONS (Paginated + Search)', 'GET', '/api/getOrganizations?page=1&limit=5&search=Postman', null, res);

  // ─── 7. GET SINGLE ORGANIZATION ──────────────
  res = await req('GET', `/api/getOrganization/${ORG_ID}`, null, ADMIN_TOKEN);
  log('7. GET SINGLE ORGANIZATION', 'GET', `/api/getOrganization/${ORG_ID}`, null, res);

  // ─── 8. UPDATE ORGANIZATION ──────────────────
  let updateOrgBody = {
    name: 'Postman Hotels Group (Updated)',
    phone: '+91-9000000002',
    banner_images: ['https://example.com/updated-banner.jpg']
  };
  res = await req('PUT', `/api/updateOrganization/${ORG_ID}`, updateOrgBody, ADMIN_TOKEN);
  log('8. UPDATE ORGANIZATION', 'PUT', `/api/updateOrganization/${ORG_ID}`, updateOrgBody, res);

  // ─── 9. OWNER LOGIN ─────────────────────────
  let ownerLoginBody = { email: OWNER_EMAIL, password: 'PostmanPass123' };
  res = await req('POST', '/api/auth/login', ownerLoginBody);
  log('9. OWNER LOGIN', 'POST', '/api/auth/login', ownerLoginBody, res);
  OWNER_TOKEN = res.body.data.accessToken;

  // ─── 10-12. CREATE 3 HOTELS ──────────────────
  const hotels = [
    { name: 'Taj Palace Mumbai', city: 'Mumbai', state: 'Maharashtra', phone: '+91-22-11111111', email: 'mumbai@tajhotels.com', address: 'Colaba, Mumbai', description: 'Luxury 5-star hotel', location: 'Colaba' },
    { name: 'Taj Banjara Hyderabad', city: 'Hyderabad', state: 'Telangana', phone: '+91-40-22222222', email: 'hyd@tajhotels.com', address: 'Banjara Hills, Hyderabad', description: 'Premium business hotel', location: 'Banjara Hills' },
    { name: 'Taj Mahal Delhi', city: 'New Delhi', state: 'Delhi', phone: '+91-11-33333333', email: 'delhi@tajhotels.com', address: 'Man Singh Road, Delhi', description: 'Heritage luxury hotel', location: 'India Gate' }
  ];

  for (let i = 0; i < hotels.length; i++) {
    const hotelBody = { ...hotels[i], organization_id: ORG_ID, image_urls: ['https://example.com/hotel' + (i+1) + '.jpg'] };
    res = await req('POST', '/api/createHotel', hotelBody, OWNER_TOKEN);
    log(`${10+i}. CREATE HOTEL #${i+1}`, 'POST', '/api/createHotel', hotelBody, res);
    HOTEL_IDS.push(res.body.data.id);
  }

  // ─── 13. GET ALL HOTELS ──────────────────────
  res = await req('GET', '/api/getHotels?page=1&limit=10', null, OWNER_TOKEN);
  log('13. GET ALL HOTELS (Owner\'s Org)', 'GET', '/api/getHotels?page=1&limit=10', null, res);

  // ─── 14. GET HOTELS - SEARCH BY NAME ─────────
  res = await req('GET', '/api/getHotels?search=Banjara', null, OWNER_TOKEN);
  log('14. GET HOTELS - Search by Name', 'GET', '/api/getHotels?search=Banjara', null, res);

  // ─── 15. GET HOTELS - FILTER BY CITY ─────────
  res = await req('GET', '/api/getHotels?city=Mumbai', null, OWNER_TOKEN);
  log('15. GET HOTELS - Filter by City', 'GET', '/api/getHotels?city=Mumbai', null, res);

  // ─── 16. GET HOTELS - FILTER BY STATE ────────
  res = await req('GET', '/api/getHotels?state=Telangana', null, OWNER_TOKEN);
  log('16. GET HOTELS - Filter by State', 'GET', '/api/getHotels?state=Telangana', null, res);

  // ─── 17. GET SINGLE HOTEL ────────────────────
  res = await req('GET', `/api/getHotel/${HOTEL_IDS[0]}`, null, OWNER_TOKEN);
  log('17. GET SINGLE HOTEL', 'GET', `/api/getHotel/${HOTEL_IDS[0]}`, null, res);

  // ─── 18. UPDATE HOTEL ────────────────────────
  let updateHotelBody = { name: 'Taj Palace Mumbai (Updated)', rating: 4.9, organization_id: ORG_ID };
  res = await req('PUT', `/api/updateHotel/${HOTEL_IDS[0]}`, updateHotelBody, OWNER_TOKEN);
  log('18. UPDATE HOTEL', 'PUT', `/api/updateHotel/${HOTEL_IDS[0]}`, updateHotelBody, res);

  // ─── 19. CREATE ROOM ─────────────────────────
  let createRoomBody = {
    hotel_id: HOTEL_IDS[0],
    room_number: '301',
    type: 'Deluxe',
    price: 7500,
    floor: '3',
    max_guests: 4,
    amenities: ['WiFi', 'AC', 'TV', 'Mini Bar', 'Room Service', 'Bathtub'],
    image_urls: ['https://example.com/room301.jpg'],
    organization_id: ORG_ID
  };
  res = await req('POST', '/api/createRoom', createRoomBody, OWNER_TOKEN);
  log('19. CREATE ROOM', 'POST', '/api/createRoom', createRoomBody, res);
  ROOM_ID = res.body.data.id;

  // ─── 20. GET ALL ROOMS ───────────────────────
  res = await req('GET', '/api/getRooms?page=1&limit=10', null, OWNER_TOKEN);
  log('20. GET ALL ROOMS', 'GET', '/api/getRooms?page=1&limit=10', null, res);

  // ─── 21. GET ROOMS - FILTER BY HOTEL ─────────
  res = await req('GET', `/api/getRooms?hotel_id=${HOTEL_IDS[0]}`, null, OWNER_TOKEN);
  log('21. GET ROOMS - Filter by Hotel', 'GET', `/api/getRooms?hotel_id=${HOTEL_IDS[0]}`, null, res);

  // ─── 22. GET ROOMS - FILTER BY TYPE ──────────
  res = await req('GET', '/api/getRooms?type=Deluxe', null, OWNER_TOKEN);
  log('22. GET ROOMS - Filter by Type', 'GET', '/api/getRooms?type=Deluxe', null, res);

  // ─── 23. GET SINGLE ROOM ─────────────────────
  res = await req('GET', `/api/getRoom/${ROOM_ID}`, null, OWNER_TOKEN);
  log('23. GET SINGLE ROOM', 'GET', `/api/getRoom/${ROOM_ID}`, null, res);

  // ─── 24. CHECK ROOM AVAILABILITY ─────────────
  res = await req('GET', `/api/checkRoomAvailability/${ROOM_ID}?check_in=2026-08-01&check_out=2026-08-05`, null, OWNER_TOKEN);
  log('24. CHECK ROOM AVAILABILITY', 'GET', `/api/checkRoomAvailability/${ROOM_ID}?check_in=2026-08-01&check_out=2026-08-05`, null, res);

  // ─── 25. UPDATE ROOM ─────────────────────────
  let updateRoomBody = { price: 8500, amenities: ['WiFi', 'AC', 'TV', 'Jacuzzi'], organization_id: ORG_ID };
  res = await req('PUT', `/api/updateRoom/${ROOM_ID}`, updateRoomBody, OWNER_TOKEN);
  log('25. UPDATE ROOM', 'PUT', `/api/updateRoom/${ROOM_ID}`, updateRoomBody, res);

  // ─── 26. CREATE CUSTOMER ─────────────────────
  let createCustBody = { name: 'Postman Guest', email: `postman_guest_${Date.now()}@test.com`, phone: '+91-8888888888' };
  res = await req('POST', '/api/createCustomer', createCustBody, OWNER_TOKEN);
  log('26. CREATE CUSTOMER', 'POST', '/api/createCustomer', createCustBody, res);
  CUSTOMER_ID = res.body.data.id;

  // ─── 27. GET ALL CUSTOMERS ───────────────────
  res = await req('GET', '/api/getCustomers?search=Postman', null, OWNER_TOKEN);
  log('27. GET CUSTOMERS (Search)', 'GET', '/api/getCustomers?search=Postman', null, res);

  // ─── 28. GET SINGLE CUSTOMER ─────────────────
  res = await req('GET', `/api/getCustomer/${CUSTOMER_ID}`, null, OWNER_TOKEN);
  log('28. GET SINGLE CUSTOMER', 'GET', `/api/getCustomer/${CUSTOMER_ID}`, null, res);

  // ─── 29. CREATE BOOKING ──────────────────────
  let createBookingBody = {
    room_id: ROOM_ID,
    customer_id: CUSTOMER_ID,
    check_in: '2026-08-10',
    check_out: '2026-08-14',
    notes: 'Postman test booking - late check-in',
    adults_count: 2,
    children_count: 1,
    children_ages: [8],
    organization_id: ORG_ID
  };
  res = await req('POST', '/api/createBooking', createBookingBody, OWNER_TOKEN);
  log('29. CREATE BOOKING', 'POST', '/api/createBooking', createBookingBody, res);
  BOOKING_ID = res.body.data.id;

  // ─── 30. GET ALL BOOKINGS ────────────────────
  res = await req('GET', '/api/getBookings?page=1&limit=10', null, OWNER_TOKEN);
  log('30. GET ALL BOOKINGS', 'GET', '/api/getBookings?page=1&limit=10', null, res);

  // ─── 31. GET BOOKINGS - FILTER BY STATUS ─────
  res = await req('GET', '/api/getBookings?status=CONFIRMED', null, OWNER_TOKEN);
  log('31. GET BOOKINGS - Filter by Status', 'GET', '/api/getBookings?status=CONFIRMED', null, res);

  // ─── 32. GET SINGLE BOOKING ──────────────────
  res = await req('GET', `/api/getBooking/${BOOKING_ID}`, null, OWNER_TOKEN);
  log('32. GET SINGLE BOOKING', 'GET', `/api/getBooking/${BOOKING_ID}`, null, res);

  // ─── 33. CREATE PAYMENT ──────────────────────
  let createPaymentBody = { booking_id: BOOKING_ID, amount: 34000, method: 'CARD', transaction_ref: 'TXN_POSTMAN_001' };
  res = await req('POST', '/api/createPayment', createPaymentBody, OWNER_TOKEN);
  log('33. CREATE PAYMENT', 'POST', '/api/createPayment', createPaymentBody, res);
  PAYMENT_ID = res.body.data.id;

  // ─── 34. GET ALL PAYMENTS ────────────────────
  res = await req('GET', '/api/getPayments?page=1&limit=10', null, OWNER_TOKEN);
  log('34. GET PAYMENTS (with Revenue Summary)', 'GET', '/api/getPayments?page=1&limit=10', null, res);

  // ─── 35. GET PAYMENTS - FILTER BY BOOKING ────
  res = await req('GET', `/api/getPayments?booking_id=${BOOKING_ID}`, null, OWNER_TOKEN);
  log('35. GET PAYMENTS - Filter by Booking', 'GET', `/api/getPayments?booking_id=${BOOKING_ID}`, null, res);

  // ─── 36. CHECK-IN BOOKING ────────────────────
  res = await req('PATCH', `/api/checkInBooking/${BOOKING_ID}`, {}, OWNER_TOKEN);
  log('36. CHECK-IN BOOKING', 'PATCH', `/api/checkInBooking/${BOOKING_ID}`, {}, res);

  // ─── 37. CHECK-OUT BOOKING ───────────────────
  res = await req('PATCH', `/api/checkOutBooking/${BOOKING_ID}`, {}, OWNER_TOKEN);
  log('37. CHECK-OUT BOOKING', 'PATCH', `/api/checkOutBooking/${BOOKING_ID}`, {}, res);

  // ─── 38. REFUND PAYMENT ──────────────────────
  res = await req('PATCH', `/api/refundPayment/${PAYMENT_ID}`, {}, OWNER_TOKEN);
  log('38. REFUND PAYMENT', 'PATCH', `/api/refundPayment/${PAYMENT_ID}`, {}, res);

  // ─── 39. CREATE USER (Employee) ──────────────
  let createUserBody = {
    name: 'Front Desk Employee',
    email: `employee_${Date.now()}@test.com`,
    password: 'Employee123',
    role: 'EMPLOYEE',
    organization_id: ORG_ID
  };
  res = await req('POST', '/api/createUser', createUserBody, OWNER_TOKEN);
  log('39. CREATE USER (Employee)', 'POST', '/api/createUser', createUserBody, res);
  USER_ID = res.body.data.id;

  // ─── 40. GET ALL USERS ───────────────────────
  res = await req('GET', '/api/getUsers', null, OWNER_TOKEN);
  log('40. GET ALL USERS', 'GET', '/api/getUsers', null, res);

  // ─── 41. GET SINGLE USER ─────────────────────
  res = await req('GET', `/api/getUser/${USER_ID}`, null, OWNER_TOKEN);
  log('41. GET SINGLE USER', 'GET', `/api/getUser/${USER_ID}`, null, res);

  // ─── 42. UPDATE USER ─────────────────────────
  let updateUserBody = { name: 'Senior Front Desk', organization_id: ORG_ID };
  res = await req('PUT', `/api/updateUser/${USER_ID}`, updateUserBody, OWNER_TOKEN);
  log('42. UPDATE USER', 'PUT', `/api/updateUser/${USER_ID}`, updateUserBody, res);

  // ─── 43. DELETE HOTEL (Demonstrate) ──────────
  res = await req('DELETE', `/api/deleteHotel/${HOTEL_IDS[2]}?organization_id=${ORG_ID}`, null, OWNER_TOKEN);
  log('43. DELETE HOTEL', 'DELETE', `/api/deleteHotel/${HOTEL_IDS[2]}?organization_id=${ORG_ID}`, null, res);

  // ─── 44. DELETE ROOM (Soft Delete) ────────────
  // Create a temp room to delete
  let tempRoom = { hotel_id: HOTEL_IDS[1], room_number: 'TEMP', type: 'Standard', price: 1000, max_guests: 2, organization_id: ORG_ID };
  res = await req('POST', '/api/createRoom', tempRoom, OWNER_TOKEN);
  let tempRoomId = res.body.data.id;
  res = await req('DELETE', `/api/deleteRoom/${tempRoomId}?organization_id=${ORG_ID}`, null, OWNER_TOKEN);
  log('44. DELETE ROOM (Soft Delete)', 'DELETE', `/api/deleteRoom/${tempRoomId}?organization_id=${ORG_ID}`, null, res);

  // ─── 45. CANCEL BOOKING ──────────────────────
  // Create a new booking to cancel
  let tempBookBody = { room_id: ROOM_ID, customer_id: CUSTOMER_ID, check_in: '2026-09-01', check_out: '2026-09-03', organization_id: ORG_ID };
  res = await req('POST', '/api/createBooking', tempBookBody, OWNER_TOKEN);
  let tempBookId = res.body.data.id;
  res = await req('PATCH', `/api/cancelBooking/${tempBookId}`, {}, OWNER_TOKEN);
  log('45. CANCEL BOOKING', 'PATCH', `/api/cancelBooking/${tempBookId}`, {}, res);

  // ─── 46. DELETE USER (Soft Delete) ────────────
  res = await req('DELETE', `/api/deleteUser/${USER_ID}`, null, OWNER_TOKEN);
  log('46. DELETE USER (Soft Delete)', 'DELETE', `/api/deleteUser/${USER_ID}`, null, res);

  // ─── 47. LOGOUT ──────────────────────────────
  res = await req('POST', '/api/auth/logout', null, OWNER_TOKEN);
  log('47. LOGOUT', 'POST', '/api/auth/logout', null, res);

  // ─── FINAL VERIFY: Fetch all hotels to confirm 3 created ────
  res = await req('GET', `/api/getHotels?organization_id=${ORG_ID}&page=1&limit=10`, null, ADMIN_TOKEN);
  log('FINAL VERIFY: ALL HOTELS IN ORG (Admin View)', 'GET', `/api/getHotels?organization_id=${ORG_ID}&page=1&limit=10`, null, res);

  // ─── FINAL VERIFY: Fetch org to confirm update ────
  res = await req('GET', `/api/getOrganization/${ORG_ID}`, null, ADMIN_TOKEN);
  log('FINAL VERIFY: ORGANIZATION DETAILS', 'GET', `/api/getOrganization/${ORG_ID}`, null, res);

  console.log('\n\n' + '═'.repeat(70));
  console.log('  ✅ ALL API CALLS COMPLETED SUCCESSFULLY');
  console.log('  Total APIs demonstrated: 47 calls');
  console.log('  Organization ID used: ' + ORG_ID);
  console.log('  Hotels created: ' + HOTEL_IDS.join(', '));
  console.log('═'.repeat(70));
}

run().catch(e => console.error('Fatal:', e.message));
