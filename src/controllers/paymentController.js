const pool = require('../config/database');
const { createError } = require('../middleware/errorHandler');

// POST /api/payments
const createPayment = async (req, res, next) => {
  try {
    const { booking_id, amount, method, transaction_ref } = req.body;
    if (!booking_id || !amount) return next(createError('booking_id and amount are required', 400));

    const bookingCheck = await pool.query('SELECT * FROM bookings WHERE id = $1', [booking_id]);
    if (!bookingCheck.rows.length) return next(createError('Booking not found', 404));

    const booking = bookingCheck.rows[0];
    if (booking.organization_id !== req.orgId) {
      return next(createError('Access denied', 403));
    }

    const { rows } = await pool.query(
      `INSERT INTO payments (booking_id, organization_id, amount, status, method, transaction_ref)
       VALUES ($1, $2, $3, 'PAID', $4, $5) RETURNING *`,
      [booking_id, booking.organization_id, parseFloat(amount),
       method || 'CASH', transaction_ref || null]
    );

    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

// GET /api/payments
const getPayments = async (req, res, next) => {
  try {
    const orgId = req.orgId;
    const params = [];
    let where = '';

    if (orgId) {
      params.push(orgId);
      where = `WHERE p.organization_id = $1`;
    }

    const { rows } = await pool.query(
      `SELECT p.*,
         c.name AS guest_name, c.email AS guest_email,
         b.check_in, b.check_out, b.status AS booking_status,
         r.room_number, h.name AS hotel_name
       FROM payments p
       JOIN bookings b ON b.id = p.booking_id
       JOIN customers c ON c.id = b.customer_id
       JOIN rooms r ON r.id = b.room_id
       JOIN hotels h ON h.id = r.hotel_id
       ${where}
       ORDER BY p.created_at DESC`,
      params
    );

    // Compute summary stats
    const successful = rows.filter(r => r.status === 'PAID');
    const totalRevenue = successful.reduce((sum, r) => sum + parseFloat(r.amount), 0);
    const refunded = rows.filter(r => r.status === 'REFUNDED').reduce((sum, r) => sum + parseFloat(r.amount), 0);

    res.json({
      success: true,
      summary: {
        total_revenue: totalRevenue,
        refunded,
        net: totalRevenue - refunded,
        transactions: rows.length
      },
      data: rows
    });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/payments/:id/refund
const refundPayment = async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM payments WHERE id = $1', [req.params.id]);
    if (!rows.length) return next(createError('Payment not found', 404));

    if (rows[0].organization_id !== req.orgId) {
      return next(createError('Access denied', 403));
    }

    const updated = await pool.query(
      `UPDATE payments SET status = 'REFUNDED' WHERE id = $1 RETURNING *`,
      [req.params.id]
    );

    res.json({ success: true, data: updated.rows[0] });
  } catch (err) {
    next(err);
  }
};

module.exports = { createPayment, getPayments, refundPayment };
