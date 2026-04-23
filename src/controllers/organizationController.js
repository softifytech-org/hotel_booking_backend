const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const { createError } = require('../middleware/errorHandler');

// ─────────────────────────────────────────────
//  POST /api/createOrganization  (Super Admin only)
// ─────────────────────────────────────────────
const createOrganization = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const {
      name, website, phone, address,
      ownerName, ownerEmail, ownerPassword,
      logo_url, code, banner_images
    } = req.body;

    // Defensive validation (express-validator handles route-level)
    if (!name || !ownerName || !ownerEmail || !ownerPassword || !code) {
      return next(createError('name, code, ownerName, ownerEmail, ownerPassword are required', 400));
    }

    if (!/^[A-Z0-9]{3}$/i.test(code)) {
      return next(createError('code must be exactly 3 alphanumeric characters (e.g., A1B)', 400));
    }

    if (banner_images !== undefined && !Array.isArray(banner_images)) {
      return next(createError('banner_images must be an array of URLs', 400));
    }

    const orgCode = code.toUpperCase();

    await client.query('BEGIN');

    // Check uniqueness of org code
    const codeCheck = await client.query('SELECT id FROM organizations WHERE code = $1', [orgCode]);
    if (codeCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return next(createError(`Organization code '${orgCode}' already exists`, 409));
    }

    // Check uniqueness of owner email
    const emailCheck = await client.query('SELECT id FROM users WHERE email = $1', [ownerEmail.toLowerCase().trim()]);
    if (emailCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return next(createError(`Email '${ownerEmail}' is already in use`, 409));
    }

    // Create organization
    const orgResult = await client.query(
      `INSERT INTO organizations (name, website, phone, address, code, logo_url, banner_images)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        name.trim(),
        website || null,
        phone || null,
        address || null,
        orgCode,
        logo_url || null,
        banner_images && banner_images.length ? banner_images : []
      ]
    );
    const org = orgResult.rows[0];

    // Create owner user
    const passwordHash = await bcrypt.hash(ownerPassword, 12);
    const userResult = await client.query(
      `INSERT INTO users (name, email, password_hash, role, organization_id)
       VALUES ($1, $2, $3, 'OWNER', $4) RETURNING id, name, email, role, organization_id, created_at`,
      [ownerName.trim(), ownerEmail.toLowerCase().trim(), passwordHash, org.id]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: `Organization "${name}" created with owner account`,
      data: { organization: org, owner: userResult.rows[0] }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────
//  GET /api/getOrganizations
//  Super Admin: paginated list with search/filter
//  Owner: own organization only
// ─────────────────────────────────────────────
const getOrganizations = async (req, res, next) => {
  try {
    if (req.user.role === 'SUPER_ADMIN') {
      const { page = 1, limit = 20, search, status } = req.query;
      const pageNum = Math.max(1, parseInt(page) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
      const offset = (pageNum - 1) * limitNum;

      const conditions = [];
      const params = [];

      if (search) {
        params.push(`%${search}%`);
        const idx = params.length;
        conditions.push(`(o.name ILIKE $${idx} OR o.code ILIKE $${idx} OR o.phone ILIKE $${idx})`);
      }

      if (status) {
        params.push(status);
        conditions.push(`o.status = $${params.length}`);
      }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      // Count total for pagination
      const countResult = await pool.query(
        `SELECT COUNT(DISTINCT o.id) AS total FROM organizations o ${where}`,
        params
      );
      const totalCount = parseInt(countResult.rows[0].total);

      // Fetch paginated results with aggregated counts
      params.push(limitNum);
      params.push(offset);
      const { rows } = await pool.query(
        `SELECT o.*,
          COUNT(DISTINCT h.id) AS hotels_count,
          COUNT(DISTINCT u.id) FILTER (WHERE u.role != 'SUPER_ADMIN') AS users_count
        FROM organizations o
        LEFT JOIN hotels h ON h.organization_id = o.id
        LEFT JOIN users u ON u.organization_id = o.id
        ${where}
        GROUP BY o.id
        ORDER BY o.created_at DESC
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
    } else {
      // Owner sees only their own organization
      const { rows } = await pool.query(
        `SELECT o.*,
          COUNT(DISTINCT h.id) AS hotels_count
        FROM organizations o
        LEFT JOIN hotels h ON h.organization_id = o.id
        WHERE o.id = $1
        GROUP BY o.id`,
        [req.user.organization_id]
      );
      res.json({ success: true, data: rows });
    }
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
//  GET /api/getOrganization/:id
// ─────────────────────────────────────────────
const getOrganizationById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (req.user.role !== 'SUPER_ADMIN' && req.user.organization_id !== parseInt(id, 10)) {
      return next(createError('Access denied', 403));
    }

    const { rows } = await pool.query(
      `SELECT o.*, COUNT(DISTINCT h.id) AS hotels_count
       FROM organizations o
       LEFT JOIN hotels h ON h.organization_id = o.id
       WHERE o.id = $1
       GROUP BY o.id`,
      [id]
    );

    if (!rows.length) return next(createError('Organization not found', 404));
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
//  PUT /api/updateOrganization/:id
// ─────────────────────────────────────────────
const updateOrganization = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, website, phone, address, status, logo_url, banner_images } = req.body;

    if (req.user.role !== 'SUPER_ADMIN' && req.user.organization_id !== parseInt(id, 10)) {
      return next(createError('Access denied', 403));
    }

    // Validate banner_images format if provided
    if (banner_images !== undefined && !Array.isArray(banner_images)) {
      return next(createError('banner_images must be an array of URLs', 400));
    }

    const { rows } = await pool.query(
      `UPDATE organizations SET
        name = COALESCE($1, name),
        website = COALESCE($2, website),
        phone = COALESCE($3, phone),
        address = COALESCE($4, address),
        status = COALESCE($5, status),
        logo_url = COALESCE($6, logo_url),
        banner_images = COALESCE($7, banner_images)
       WHERE id = $8 RETURNING *`,
      [name, website, phone, address, status, logo_url,
       banner_images !== undefined ? banner_images : null, id]
    );

    if (!rows.length) return next(createError('Organization not found', 404));
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

module.exports = { createOrganization, getOrganizations, getOrganizationById, updateOrganization };
