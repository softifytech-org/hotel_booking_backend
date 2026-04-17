const errorHandler = (err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);

  // PostgreSQL unique violation
  if (err.code === '23505') {
    const match = err.detail?.match(/\((.+)\)=\((.+)\)/);
    const field = match ? match[1] : 'field';
    const value = match ? match[2] : '';
    return res.status(409).json({
      success: false,
      message: `${field} '${value}' already exists`
    });
  }

  // Foreign key violation
  if (err.code === '23503') {
    return res.status(400).json({ success: false, message: 'Referenced record does not exist' });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }

  // Validation errors from express-validator
  if (err.type === 'validation') {
    return res.status(422).json({ success: false, message: err.message, errors: err.errors });
  }

  // Default server error
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

// Create custom operational errors
const createError = (message, statusCode = 400) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

module.exports = { errorHandler, createError };
