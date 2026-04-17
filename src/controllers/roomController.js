const pool = require('../config/database');
const { createError } = require('../middleware/errorHandler');

// POST /api/rooms
const createRoom = async (req, res, next) => {
  try {
    const {
      hotel_id, room_number, type, price, floor,
      max_guests, adults, children, amenities, image_urls
    } = req.body;

    if (!hotel_id || !room_number || !price) {
      return next(createError('hotel_id, room_number, price are required', 400));
    }
    if (!max_guests || max_guests < 1) {
      return next(createError('max_guests must be at least 1', 400));
    }

    // Verify hotel belongs to user's org
    const hotelCheck = await pool.query('SELECT organization_id FROM hotels WHERE id = $1', [hotel_id]);
    if (!hotelCheck.rows.length) return next(createError('Hotel not found', 404));
    if (hotelCheck.rows[0].organization_id !== req.orgId) {
      return next(createError('Access denied', 403));
    }

    const { rows } = await pool.query(
      `INSERT INTO rooms
        (hotel_id, room_number, type, price, floor, max_guests, amenities, image_urls)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        hotel_id, room_number, type || 'Standard', parseFloat(price),
        floor || '1', parseInt(max_guests),
        amenities && amenities.length ? amenities : [],
        image_urls && image_urls.length ? image_urls : []
      ]
    );

    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

// GET /api/rooms?hotel_id=...
const getRooms = async (req, res, next) => {
  try {
    const { hotel_id, status } = req.query;
    const conditions = [];
    const params = [];

    if (req.user.role !== 'SUPER_ADMIN') {
      params.push(req.user.organization_id);
      conditions.push(`h.organization_id = $${params.length}`);
    }

    if (hotel_id) {
      params.push(hotel_id);
      conditions.push(`r.hotel_id = $${params.length}`);
    }

    if (status) {
      params.push(status);
      conditions.push(`r.status = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await pool.query(
      `SELECT r.*, h.name AS hotel_name, h.organization_id
       FROM rooms r
       JOIN hotels h ON h.id = r.hotel_id
       ${where}
       ORDER BY r.created_at DESC`,
      params
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

// GET /api/rooms/:id
const getRoomById = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.*, h.name AS hotel_name, h.organization_id
       FROM rooms r JOIN hotels h ON h.id = r.hotel_id
       WHERE r.id = $1`,
      [req.params.id]
    );

    if (!rows.length) return next(createError('Room not found', 404));
    if (rows[0].organization_id !== req.orgId) {
      return next(createError('Access denied', 403));
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

// PUT /api/rooms/:id
const updateRoom = async (req, res, next) => {
  try {
    const {
      room_number, type, price, floor, max_guests,
      adults, children, amenities, image_urls, status, is_active
    } = req.body;

    const existing = await pool.query(
      `SELECT r.*, h.organization_id FROM rooms r
       JOIN hotels h ON h.id = r.hotel_id WHERE r.id = $1`,
      [req.params.id]
    );
    if (!existing.rows.length) return next(createError('Room not found', 404));
    if (existing.rows[0].organization_id !== req.orgId) {
      return next(createError('Access denied', 403));
    }

    const { rows } = await pool.query(
      `UPDATE rooms SET
        room_number = COALESCE($1, room_number),
        type        = COALESCE($2, type),
        price       = COALESCE($3, price),
        floor       = COALESCE($4, floor),
        max_guests  = COALESCE($5, max_guests),
        amenities   = COALESCE($6, amenities),
        image_urls  = COALESCE($7, image_urls),
        status      = COALESCE($8, status),
        is_active   = COALESCE($9, is_active)
       WHERE id = $10 RETURNING *`,
      [room_number, type, price ? parseFloat(price) : null, floor,
       max_guests ? parseInt(max_guests) : null,
       amenities, image_urls, status, is_active, req.params.id]
    );

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/rooms/:id
const deleteRoom = async (req, res, next) => {
  try {
    const existing = await pool.query(
      `SELECT r.id, h.organization_id FROM rooms r
       JOIN hotels h ON h.id = r.hotel_id WHERE r.id = $1`,
      [req.params.id]
    );
    if (!existing.rows.length) return next(createError('Room not found', 404));
    if (existing.rows[0].organization_id !== req.orgId) {
      return next(createError('Access denied', 403));
    }

    await pool.query('UPDATE rooms SET is_active = false WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Room deactivated' });
  } catch (err) {
    next(err);
  }
};

// GET /api/rooms/:id/availability?check_in=&check_out=
const checkAvailability = async (req, res, next) => {
  try {
    const { check_in, check_out } = req.query;
    if (!check_in || !check_out) return next(createError('check_in and check_out required', 400));

    const { rows } = await pool.query(
      `SELECT COUNT(*) FROM bookings
       WHERE room_id = $1
         AND status NOT IN ('CANCELLED', 'CHECKED_OUT')
         AND NOT (check_out <= $2 OR check_in >= $3)`,
      [req.params.id, check_in, check_out]
    );

    const isAvailable = parseInt(rows[0].count) === 0;
    res.json({ success: true, data: { available: isAvailable } });
  } catch (err) {
    next(err);
  }
};

module.exports = { createRoom, getRooms, getRoomById, updateRoom, deleteRoom, checkAvailability };
