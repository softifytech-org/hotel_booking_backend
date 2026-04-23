const pool = require('../config/database');
const { createError } = require('../middleware/errorHandler');

// ─────────────────────────────────────────────
//  POST /api/createBooking
// ─────────────────────────────────────────────
const createBooking = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { room_id, customer_id, check_in, check_out, notes, adults_count, children_count, children_ages } = req.body;
    const orgId = req.orgId;

    if (!room_id || !customer_id || !check_in || !check_out) {
      return next(createError('room_id, customer_id, check_in, check_out are required', 400));
    }

    await client.query('BEGIN');

    // Lock the room row to prevent race conditions
    const roomResult = await client.query(
      `SELECT r.*, h.organization_id FROM rooms r
       JOIN hotels h ON h.id = r.hotel_id
       WHERE r.id = $1 AND r.is_active = true FOR UPDATE`,
      [room_id]
    );

    if (!roomResult.rows.length) {
      await client.query('ROLLBACK');
      return next(createError('Room not found or inactive', 404));
    }

    const room = roomResult.rows[0];
    if (room.organization_id !== orgId) {
      await client.query('ROLLBACK');
      return next(createError('Access denied', 403));
    }

    if (room.status !== 'Available') {
      await client.query('ROLLBACK');
      return next(createError('Room is not available', 409));
    }

    // Check for overlapping bookings (the core double-booking prevention)
    const overlapCheck = await client.query(
      `SELECT id FROM bookings
       WHERE room_id = $1
         AND status NOT IN ('CANCELLED', 'CHECKED_OUT')
         AND NOT (check_out <= $2::date OR check_in >= $3::date)`,
      [room_id, check_in, check_out]
    );

    if (overlapCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return next(createError('Room is already booked for the selected dates', 409));
    }

    // Calculate total price
    const checkInDate = new Date(check_in);
    const checkOutDate = new Date(check_out);
    const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
    if (nights <= 0) {
      await client.query('ROLLBACK');
      return next(createError('Check-out must be after check-in', 400));
    }
    const totalPrice = nights * parseFloat(room.price);

    // Create booking
    const bookingResult = await client.query(
      `INSERT INTO bookings (room_id, customer_id, organization_id, check_in, check_out, total_price, notes, status, adults_count, children_count, children_ages)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'CONFIRMED', $8, $9, $10) RETURNING *`,
      [room_id, customer_id, orgId, check_in, check_out, totalPrice, notes || null, adults_count || 1, children_count || 0, children_ages ? JSON.stringify(children_ages) : '[]']
    );

    // Update room status
    await client.query(`UPDATE rooms SET status = 'Occupied' WHERE id = $1`, [room_id]);

    await client.query('COMMIT');

    // Return booking with customer + room details
    const { rows } = await pool.query(
      `SELECT b.*,
         c.name AS guest_name, c.email AS guest_email, c.phone AS guest_phone,
         r.room_number, r.type AS room_type, r.price AS room_price,
         h.name AS hotel_name
       FROM bookings b
       JOIN customers c ON c.id = b.customer_id
       JOIN rooms r ON r.id = b.room_id
       JOIN hotels h ON h.id = r.hotel_id
       WHERE b.id = $1`,
      [bookingResult.rows[0].id]
    );

    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────
//  GET /api/getBookings
//  Paginated list with filters: status, hotel_id,
//  customer_id, room_id, organization_id
// ─────────────────────────────────────────────
const getBookings = async (req, res, next) => {
  try {
    const { status, hotel_id, customer_id, room_id, page = 1, limit = 20 } = req.query;
    const orgId = req.orgId;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    const params = [];

    if (orgId) {
      params.push(orgId);
      conditions.push(`b.organization_id = $${params.length}`);
    }
    if (status) {
      params.push(status.toUpperCase());
      conditions.push(`b.status = $${params.length}`);
    }
    if (hotel_id) {
      params.push(hotel_id);
      conditions.push(`h.id = $${params.length}`);
    }
    if (customer_id) {
      params.push(customer_id);
      conditions.push(`b.customer_id = $${params.length}`);
    }
    if (room_id) {
      params.push(room_id);
      conditions.push(`b.room_id = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total for pagination
    const countResult = await pool.query(
      `SELECT COUNT(*) AS total
       FROM bookings b
       JOIN rooms r ON r.id = b.room_id
       JOIN hotels h ON h.id = r.hotel_id
       ${where}`,
      params
    );
    const totalCount = parseInt(countResult.rows[0].total);

    // Fetch paginated results
    params.push(limitNum);
    params.push(offset);
    const { rows } = await pool.query(
      `SELECT b.*,
         c.name AS guest_name, c.email AS guest_email, c.phone AS guest_phone,
         r.room_number, r.type AS room_type, r.price AS room_price,
         h.name AS hotel_name, h.id AS hotel_id
       FROM bookings b
       JOIN customers c ON c.id = b.customer_id
       JOIN rooms r ON r.id = b.room_id
       JOIN hotels h ON h.id = r.hotel_id
       ${where}
       ORDER BY b.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      success: true,
      data: rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total_count: totalCount,
        total_pages: Math.ceil(totalCount / limitNum)
      }
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
//  GET /api/getBooking/:id
// ─────────────────────────────────────────────
const getBookingById = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT b.*,
         c.name AS guest_name, c.email AS guest_email, c.phone AS guest_phone,
         r.room_number, r.type AS room_type, r.max_guests,
         h.name AS hotel_name, h.id AS hotel_id
       FROM bookings b
       JOIN customers c ON c.id = b.customer_id
       JOIN rooms r ON r.id = b.room_id
       JOIN hotels h ON h.id = r.hotel_id
       WHERE b.id = $1`,
      [req.params.id]
    );

    if (!rows.length) return next(createError('Booking not found', 404));
    if (req.orgId && rows[0].organization_id !== req.orgId) {
      return next(createError('Access denied', 403));
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
//  PATCH /api/checkInBooking/:id
// ─────────────────────────────────────────────
const checkInBooking = async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query('SELECT * FROM bookings WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!rows.length) return next(createError('Booking not found', 404));

    const booking = rows[0];
    if (booking.status !== 'CONFIRMED') {
      await client.query('ROLLBACK');
      return next(createError(`Cannot check-in a booking with status: ${booking.status}`, 409));
    }

    await client.query(`UPDATE bookings SET status = 'CHECKED_IN' WHERE id = $1`, [req.params.id]);
    await client.query(`UPDATE rooms SET status = 'Occupied' WHERE id = $1`, [booking.room_id]);

    await client.query('COMMIT');
    res.json({ success: true, message: 'Guest checked in successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────
//  PATCH /api/checkOutBooking/:id
// ─────────────────────────────────────────────
const checkOutBooking = async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query('SELECT * FROM bookings WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!rows.length) return next(createError('Booking not found', 404));

    const booking = rows[0];
    if (booking.status !== 'CHECKED_IN') {
      await client.query('ROLLBACK');
      return next(createError(`Cannot check-out a booking with status: ${booking.status}`, 409));
    }

    await client.query(`UPDATE bookings SET status = 'CHECKED_OUT' WHERE id = $1`, [req.params.id]);
    await client.query(`UPDATE rooms SET status = 'Available' WHERE id = $1`, [booking.room_id]);

    // Auto-create payment record
    await client.query(
      `INSERT INTO payments (booking_id, organization_id, amount, status, method)
       VALUES ($1, $2, $3, 'PAID', 'CASH')`,
      [booking.id, booking.organization_id, booking.total_price]
    );

    await client.query('COMMIT');
    res.json({ success: true, message: 'Guest checked out and payment recorded' });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────
//  PATCH /api/cancelBooking/:id
// ─────────────────────────────────────────────
const cancelBooking = async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query('SELECT * FROM bookings WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!rows.length) return next(createError('Booking not found', 404));

    const booking = rows[0];
    if (['CHECKED_OUT', 'CANCELLED'].includes(booking.status)) {
      await client.query('ROLLBACK');
      return next(createError(`Booking is already ${booking.status}`, 409));
    }

    await client.query(`UPDATE bookings SET status = 'CANCELLED' WHERE id = $1`, [req.params.id]);
    await client.query(`UPDATE rooms SET status = 'Available' WHERE id = $1`, [booking.room_id]);

    await client.query('COMMIT');
    res.json({ success: true, message: 'Booking cancelled successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

module.exports = { createBooking, getBookings, getBookingById, checkInBooking, checkOutBooking, cancelBooking };
