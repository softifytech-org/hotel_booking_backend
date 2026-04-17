const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { createError } = require('../middleware/errorHandler');

const generateTokens = (userId, role, orgId) => {
  const payload = { userId, role, orgId };
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m'
  });
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  });
  return { accessToken, refreshToken };
};

// POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return next(createError('Email and password are required', 400));
    }

    const { rows } = await pool.query(
      `SELECT u.*, o.name as org_name 
       FROM users u 
       LEFT JOIN organizations o ON u.organization_id = o.id
       WHERE u.email = $1`,
      [email.toLowerCase().trim()]
    );

    const user = rows[0];
    if (!user) return next(createError('Invalid credentials', 401));

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) return next(createError('Invalid credentials', 401));

    if (user.status !== 'Active') {
      return next(createError('Account is suspended. Contact support.', 403));
    }

    const { accessToken, refreshToken } = generateTokens(user.id, user.role, user.organization_id);

    // Persist refresh token in DB
    await pool.query('UPDATE users SET refresh_token = $1, last_active = NOW() WHERE id = $2', [
      refreshToken, user.id
    ]);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          organization_id: user.organization_id,
          org_name: user.org_name,
        },
        accessToken,
        refreshToken,
      }
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/refresh
const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return next(createError('Refresh token required', 400));

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    const { rows } = await pool.query(
      'SELECT * FROM users WHERE id = $1 AND refresh_token = $2',
      [decoded.userId, refreshToken]
    );

    if (!rows.length) return next(createError('Invalid refresh token', 401));

    const user = rows[0];
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(
      user.id, user.role, user.organization_id
    );

    await pool.query('UPDATE users SET refresh_token = $1 WHERE id = $2', [newRefreshToken, user.id]);

    res.json({ success: true, data: { accessToken, refreshToken: newRefreshToken } });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/logout
const logout = async (req, res, next) => {
  try {
    await pool.query('UPDATE users SET refresh_token = NULL WHERE id = $1', [req.user.id]);
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

// GET /api/auth/me
const getMe = async (req, res) => {
  res.json({ success: true, data: { user: req.user } });
};

module.exports = { login, refresh, logout, getMe };
