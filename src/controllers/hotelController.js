const pool = require('../config/database');
const { createError } = require('../middleware/errorHandler');

// ─────────────────────────────────────────────
//  POST /api/createHotel
//  Creates a hotel within the authenticated org
// ─────────────────────────────────────────────
const createOrganizationHotel = async (req, res, next) => {
  try {
    const orgId = req.orgId; // Injected by requireOrgAccess
    if (!orgId) return next(createError('Organization context required', 400));

    const { name, location, description, phone, email, address, image_urls, city, state } = req.body;

    // Defensive validation (express-validator handles route-level)
    if (!name) return next(createError('Hotel name is required', 400));
    if (!city || !city.trim()) return next(createError('City is required', 400));
    if (!state || !state.trim()) return next(createError('State is required', 400));

    const { rows } = await pool.query(
      `INSERT INTO hotels (organization_id, name, location, description, phone, email, address, image_urls, city, state)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        orgId,
        name.trim(),
        location || null,
        description || null,
        phone || null,
        email || null,
        address || null,
        image_urls && image_urls.length ? image_urls : [],
        city.trim(),
        state.trim()
      ]
    );

    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
//  GET /api/getHotels
//  Paginated list with search by name/city/state
//  Scoped to org unless super admin
// ─────────────────────────────────────────────
const getOrganizationHotels = async (req, res, next) => {
  try {
    const scopedOrgId = req.orgId;
    const { search, city, state, organization_id, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    const params = [];

    // Organization scoping
    if (scopedOrgId) {
      params.push(scopedOrgId);
      conditions.push(`h.organization_id = $${params.length}`);
    } else if (organization_id) {
      params.push(organization_id);
      conditions.push(`h.organization_id = $${params.length}`);
    }

    // Search by hotel name
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`h.name ILIKE $${params.length}`);
    }

    // Filter by city
    if (city) {
      params.push(`%${city}%`);
      conditions.push(`h.city ILIKE $${params.length}`);
    }

    // Filter by state
    if (state) {
      params.push(`%${state}%`);
      conditions.push(`h.state ILIKE $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total for pagination
    const countResult = await pool.query(
      `SELECT COUNT(DISTINCT h.id) AS total FROM hotels h ${where}`,
      params
    );
    const totalCount = parseInt(countResult.rows[0].total);

    // Fetch paginated results with room counts
    params.push(limitNum);
    params.push(offset);
    const { rows } = await pool.query(
      `SELECT h.*,
        COUNT(DISTINCT r.id) AS rooms_count,
        COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'Available') AS available_rooms
      FROM hotels h
      LEFT JOIN rooms r ON r.hotel_id = h.id
      ${where}
      GROUP BY h.id
      ORDER BY h.created_at DESC
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
//  GET /api/getHotel/:id
// ─────────────────────────────────────────────
const getOrganizationHotelById = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT h.*, COUNT(DISTINCT r.id) AS rooms_count
       FROM hotels h LEFT JOIN rooms r ON r.hotel_id = h.id
       WHERE h.id = $1 GROUP BY h.id`,
      [req.params.id]
    );

    if (!rows.length) return next(createError('Hotel not found', 404));

    const hotel = rows[0];
    if (req.orgId && hotel.organization_id !== req.orgId) {
      return next(createError('Access denied', 403));
    }

    res.json({ success: true, data: hotel });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
//  PUT /api/updateHotel/:id
// ─────────────────────────────────────────────
const updateOrganizationHotel = async (req, res, next) => {
  try {
    const { name, location, description, phone, email, address, image_urls, status, rating, city, state } = req.body;

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
        rating = COALESCE($9, rating),
        city = COALESCE($10, city),
        state = COALESCE($11, state)
       WHERE id = $12 RETURNING *`,
      [name, location, description, phone, email, address,
       image_urls, status, rating, city, state, req.params.id]
    );

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
//  DELETE /api/deleteHotel/:id
// ─────────────────────────────────────────────
const deleteOrganizationHotel = async (req, res, next) => {
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

module.exports = {
  createOrganizationHotel,
  getOrganizationHotels,
  getOrganizationHotelById,
  updateOrganizationHotel,
  deleteOrganizationHotel
};
