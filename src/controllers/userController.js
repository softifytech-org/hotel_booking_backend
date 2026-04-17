const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const { createError } = require('../middleware/errorHandler');

// POST /api/users  (Create employee — Owner+ only)
const createUser = async (req, res, next) => {
  try {
    const { name, email, role, password } = req.body;
    if (!name || !email) return next(createError('name and email are required', 400));

    // Owners can only create EMPLOYEE accounts
    if (req.user.role === 'OWNER' && role && role !== 'EMPLOYEE') {
      return next(createError('Owners can only create Employee accounts', 403));
    }

    const orgId = req.orgId;
    const plainPassword = password || 'Welcome@123';
    const passwordHash = await bcrypt.hash(plainPassword, 12);

    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, organization_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, role, organization_id, status, created_at`,
      [name.trim(), email.toLowerCase().trim(), passwordHash,
       role || 'EMPLOYEE', orgId]
    );

    res.status(201).json({
      success: true,
      data: rows[0],
      message: `User created. Temporary password: ${plainPassword}`
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/users
const getUsers = async (req, res, next) => {
  try {
    const orgId = req.orgId;
    const params = [];
    let where = '';

    if (orgId) {
      params.push(orgId);
      where = `WHERE u.organization_id = $1`;
    } else {
      where = `WHERE u.role != 'SUPER_ADMIN'`;
    }

    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.status, u.last_active, u.created_at,
         o.name AS org_name
       FROM users u
       LEFT JOIN organizations o ON o.id = u.organization_id
       ${where}
       ORDER BY u.created_at DESC`,
      params
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

// GET /api/users/:id
const getUserById = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.status, u.last_active, u.created_at,
         o.name AS org_name
       FROM users u LEFT JOIN organizations o ON o.id = u.organization_id
       WHERE u.id = $1`,
      [req.params.id]
    );

    if (!rows.length) return next(createError('User not found', 404));

    // Owners can only see their org's users
    if (rows[0].organization_id !== req.orgId) {
      return next(createError('Access denied', 403));
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

// PUT /api/users/:id
const updateUser = async (req, res, next) => {
  try {
    const { name, status, role } = req.body;

    const existing = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (!existing.rows.length) return next(createError('User not found', 404));

    if (existing.rows[0].organization_id !== req.orgId) {
      return next(createError('Access denied', 403));
    }

    const { rows } = await pool.query(
      `UPDATE users SET
        name   = COALESCE($1, name),
        status = COALESCE($2, status),
        role   = COALESCE($3, role)
       WHERE id = $4
       RETURNING id, name, email, role, status, updated_at`,
      [name, status, role, req.params.id]
    );

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/users/:id  (soft delete — set status = Inactive)
const deleteUser = async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) {
      return next(createError('Cannot deactivate yourself', 400));
    }
    await pool.query(`UPDATE users SET status = 'Inactive' WHERE id = $1`, [req.params.id]);
    res.json({ success: true, message: 'User deactivated' });
  } catch (err) {
    next(err);
  }
};

module.exports = { createUser, getUsers, getUserById, updateUser, deleteUser };
