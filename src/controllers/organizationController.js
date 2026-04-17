const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const { createError } = require('../middleware/errorHandler');

// POST /api/organizations  (Super Admin only)
const createOrganization = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { name, website, phone, address, ownerName, ownerEmail, ownerPassword, logo_url, code } = req.body;
    if (!name || !ownerName || !ownerEmail || !ownerPassword || !code) {
      return next(createError('name, code, ownerName, ownerEmail, ownerPassword are required', 400));
    }

    if (!/^[A-Z0-9]{3}$/i.test(code)) {
      return next(createError('code must be exactly 3 alphanumeric characters (e.g., A1B)', 400));
    }

    const orgCode = code.toUpperCase();

    await client.query('BEGIN');

    // Create org
    const orgResult = await client.query(
      `INSERT INTO organizations (name, website, phone, address, code, logo_url)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name.trim(), website || null, phone || null, address || null, orgCode, logo_url || null]
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

// GET /api/organizations  (Super Admin sees all; Owner sees own)
const getOrganizations = async (req, res, next) => {
  try {
    let query, params;

    if (req.user.role === 'SUPER_ADMIN') {
      query = `
        SELECT o.*,
          COUNT(DISTINCT h.id) AS hotels_count,
          COUNT(DISTINCT u.id) FILTER (WHERE u.role != 'SUPER_ADMIN') AS users_count
        FROM organizations o
        LEFT JOIN hotels h ON h.organization_id = o.id
        LEFT JOIN users u ON u.organization_id = o.id
        GROUP BY o.id
        ORDER BY o.created_at DESC
      `;
      params = [];
    } else {
      query = `
        SELECT o.*,
          COUNT(DISTINCT h.id) AS hotels_count
        FROM organizations o
        LEFT JOIN hotels h ON h.organization_id = o.id
        WHERE o.id = $1
        GROUP BY o.id
      `;
      params = [req.user.organization_id];
    }

    const { rows } = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

// GET /api/organizations/:id
const getOrganizationById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (req.user.role !== 'SUPER_ADMIN' && req.user.organization_id !== id) {
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

// PUT /api/organizations/:id
const updateOrganization = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, website, phone, address, status, logo_url } = req.body;

    if (req.user.role !== 'SUPER_ADMIN' && req.user.organization_id !== id) {
      return next(createError('Access denied', 403));
    }

    const { rows } = await pool.query(
      `UPDATE organizations SET
        name = COALESCE($1, name),
        website = COALESCE($2, website),
        phone = COALESCE($3, phone),
        address = COALESCE($4, address),
        status = COALESCE($5, status),
        logo_url = COALESCE($6, logo_url)
       WHERE id = $7 RETURNING *`,
      [name, website, phone, address, status, logo_url, id]
    );

    if (!rows.length) return next(createError('Organization not found', 404));
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

module.exports = { createOrganization, getOrganizations, getOrganizationById, updateOrganization };
