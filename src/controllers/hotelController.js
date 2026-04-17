const pool = require('../config/database');
const { createError } = require('../middleware/errorHandler');

// Scope org: owners can only touch their own org's hotels
const getOrgId = (req) =>
  req.user.role === 'SUPER_ADMIN' ? null : req.user.organization_id;

// POST /api/hotels
const createHotel = async (req, res, next) => {
  try {
    const orgId = req.orgId; // Injected by requireOrgAccess
    if (!orgId) return next(createError('Organization context required', 400));

    const { name, location, description, phone, email, address, image_urls } = req.body;
    if (!name) return next(createError('Hotel name is required', 400));

    const { rows } = await pool.query(
      `INSERT INTO hotels (organization_id, name, location, description, phone, email, address, image_urls)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [orgId, name.trim(), location || null, description || null,
       phone || null, email || null, address || null,
       image_urls && image_urls.length ? image_urls : []]
    );

    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

// GET /api/hotels  (scoped to org unless super admin adds ?orgId=)
const getHotels = async (req, res, next) => {
  try {
    // req.orgId handles both OWNER tracking and SUPER_ADMIN explicitly passed orgId
    const scopedOrgId = req.orgId;

    let query = `
      SELECT h.*,
        COUNT(DISTINCT r.id) AS rooms_count,
        COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'Available') AS available_rooms
      FROM hotels h
      LEFT JOIN rooms r ON r.hotel_id = h.id
    `;
    const params = [];

    if (scopedOrgId) {
      query += ' WHERE h.organization_id = $1';
      params.push(scopedOrgId);
    }

    query += ' GROUP BY h.id ORDER BY h.created_at DESC';

    const { rows } = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

// GET /api/hotels/:id
const getHotelById = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT h.*, COUNT(DISTINCT r.id) AS rooms_count
       FROM hotels h LEFT JOIN rooms r ON r.hotel_id = h.id
       WHERE h.id = $1 GROUP BY h.id`,
      [req.params.id]
    );

    if (!rows.length) return next(createError('Hotel not found', 404));

    const hotel = rows[0];
    if (hotel.organization_id !== req.orgId) {
      return next(createError('Access denied', 403));
    }

    res.json({ success: true, data: hotel });
  } catch (err) {
    next(err);
  }
};

// PUT /api/hotels/:id
const updateHotel = async (req, res, next) => {
  try {
    const { name, location, description, phone, email, address, image_urls, status, rating } = req.body;

    const existing = await pool.query('SELECT * FROM hotels WHERE id = $1', [req.params.id]);
    if (!existing.rows.length) return next(createError('Hotel not found', 404));

    if (existing.rows[0].organization_id !== req.orgId) {
      return next(createError('Access denied', 403));
    }

    const { rows } = await pool.query(
      `UPDATE hotels SET
        name = COALESCE($1, name),
        location = COALESCE($2, location),
        description = COALESCE($3, description),
        phone = COALESCE($4, phone),
        email = COALESCE($5, email),
        address = COALESCE($6, address),
        image_urls = COALESCE($7, image_urls),
        status = COALESCE($8, status),
        rating = COALESCE($9, rating)
       WHERE id = $10 RETURNING *`,
      [name, location, description, phone, email, address,
       image_urls, status, rating, req.params.id]
    );

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/hotels/:id
const deleteHotel = async (req, res, next) => {
  try {
    const existing = await pool.query('SELECT * FROM hotels WHERE id = $1', [req.params.id]);
    if (!existing.rows.length) return next(createError('Hotel not found', 404));

    if (existing.rows[0].organization_id !== req.orgId) {
      return next(createError('Access denied', 403));
    }

    await pool.query('DELETE FROM hotels WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Hotel deleted successfully' });
  } catch (err) {
    next(err);
  }
};

module.exports = { createHotel, getHotels, getHotelById, updateHotel, deleteHotel };
