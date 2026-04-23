const pool = require('../config/database');
const { createError } = require('../middleware/errorHandler');

// ─────────────────────────────────────────────
//  POST /api/createRoom
// ─────────────────────────────────────────────
const createHotelRoom = async (req, res, next) => {
  try {
    const {
      hotel_id, room_number, type, price, floor,
      max_guests, amenities, image_urls
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

// ─────────────────────────────────────────────
//  GET /api/getRooms
//  Paginated list with filters: hotel_id, status,
//  search by room_number, filter by type
// ─────────────────────────────────────────────
const getHotelRooms = async (req, res, next) => {
  try {
    const { hotel_id, status, search, type, organization_id, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    const params = [];

    // Organization scoping
    if (req.orgId) {
      params.push(req.orgId);
      conditions.push(`h.organization_id = $${params.length}`);
    } else if (organization_id) {
      params.push(organization_id);
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

    // Search by room number
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`r.room_number ILIKE $${params.length}`);
    }

    // Filter by room type
    if (type) {
      params.push(type);
      conditions.push(`r.type = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total for pagination
    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM rooms r JOIN hotels h ON h.id = r.hotel_id ${where}`,
      params
    );
    const totalCount = parseInt(countResult.rows[0].total);

    // Fetch paginated results
    params.push(limitNum);
    params.push(offset);
    const { rows } = await pool.query(
      `SELECT r.*, h.name AS hotel_name, h.organization_id
       FROM rooms r
       JOIN hotels h ON h.id = r.hotel_id
       ${where}
       ORDER BY r.created_at DESC
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
//  GET /api/getRoom/:id
// ─────────────────────────────────────────────
const getHotelRoomById = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.*, h.name AS hotel_name, h.organization_id
       FROM rooms r JOIN hotels h ON h.id = r.hotel_id
       WHERE r.id = $1`,
      [req.params.id]
    );

    if (!rows.length) return next(createError('Room not found', 404));
    if (req.orgId && rows[0].organization_id !== req.orgId) {
      return next(createError('Access denied', 403));
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
//  PUT /api/updateRoom/:id
// ─────────────────────────────────────────────
const updateHotelRoom = async (req, res, next) => {
  try {
    const {
      room_number, type, price, floor, max_guests,
      amenities, image_urls, status, is_active
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

// ─────────────────────────────────────────────
//  DELETE /api/deleteRoom/:id  (soft delete)
// ─────────────────────────────────────────────
const deleteHotelRoom = async (req, res, next) => {
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

// ─────────────────────────────────────────────
//  GET /api/checkRoomAvailability/:id
// ─────────────────────────────────────────────
const checkHotelRoomAvailability = async (req, res, next) => {
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

module.exports = {
  createHotelRoom,
  getHotelRooms,
  getHotelRoomById,
  updateHotelRoom,
  deleteHotelRoom,
  checkHotelRoomAvailability
};
