const pool = require('../config/database');
const { createError } = require('../middleware/errorHandler');

// POST /api/customers  — upsert by email
const createOrGetCustomer = async (req, res, next) => {
  try {
    const { name, email, phone } = req.body;
    if (!name || !email) return next(createError('name and email are required', 400));

    // Upsert: if customer with same email exists, update; else create
    const { rows } = await pool.query(
      `INSERT INTO customers (name, email, phone)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET
         name  = EXCLUDED.name,
         phone = COALESCE(EXCLUDED.phone, customers.phone)
       RETURNING *`,
      [name.trim(), email.toLowerCase().trim(), phone || null]
    );

    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

// GET /api/customers
const getCustomers = async (req, res, next) => {
  try {
    const { search } = req.query;
    let query = `SELECT c.*,
        COUNT(DISTINCT b.id) AS total_bookings,
        SUM(b.total_price) FILTER (WHERE b.status = 'CHECKED_OUT') AS total_spent
      FROM customers c
      LEFT JOIN bookings b ON b.customer_id = c.id
    `;
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      query += ` WHERE c.name ILIKE $1 OR c.email ILIKE $1`;
    }

    query += ' GROUP BY c.id ORDER BY c.created_at DESC';

    const { rows } = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

// GET /api/customers/:id
const getCustomerById = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.*,
         json_agg(json_build_object(
           'id', b.id, 'check_in', b.check_in, 'check_out', b.check_out,
           'status', b.status, 'total_price', b.total_price,
           'hotel_name', h.name, 'room_number', r.room_number
         ) ORDER BY b.created_at DESC) AS bookings
       FROM customers c
       LEFT JOIN bookings b ON b.customer_id = c.id
       LEFT JOIN rooms r ON r.id = b.room_id
       LEFT JOIN hotels h ON h.id = r.hotel_id
       WHERE c.id = $1
       GROUP BY c.id`,
      [req.params.id]
    );

    if (!rows.length) return next(createError('Customer not found', 404));
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

module.exports = { createOrGetCustomer, getCustomers, getCustomerById };
