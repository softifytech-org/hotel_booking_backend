const pool = require('../config/database');

// Role hierarchy guard — pass allowed roles as an array
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${allowedRoles.join(' or ')}`
      });
    }
    next();
  };
};

const requireOrgAccess = async (req, res, next) => {
  try {
    if (req.user.role === 'SUPER_ADMIN') {
      // SUPER_ADMIN must explicitly provide the organization context
      const rawOrgId = req.params.orgId || req.body.organization_id || req.body.orgId || req.query.orgId || req.query.organization_id;

      if (!rawOrgId) {
        // Allow GET without orgId for global scanning (e.g. list all hotels)
        if (req.method === 'GET') {
          req.orgId = null;
          return next();
        }
        return res.status(400).json({ success: false, message: 'organization_id is required for super admin operations' });
      }

      const orgId = parseInt(rawOrgId, 10);
      if (isNaN(orgId)) {
        return res.status(400).json({ success: false, message: 'organization_id must be a valid integer' });
      }

      // Validate the org actually exists before setting context
      const { rows } = await pool.query('SELECT id FROM organizations WHERE id = $1', [orgId]);
      if (!rows.length) {
        return res.status(404).json({ success: false, message: 'Organization not found' });
      }

      req.orgId = orgId;
      return next();
    }

    // For OWNER, automatically align to their token
    req.orgId = req.user.organization_id;

    // Extra check: If an OWNER tries to act on *another* orgId passed in the payload, block them
    const explicitOrgId = req.params.orgId || req.body.organization_id || req.body.orgId || req.query.orgId || req.query.organization_id;
    if (explicitOrgId && parseInt(explicitOrgId, 10) !== req.orgId) {
      return res.status(403).json({ success: false, message: 'Access denied to this organization' });
    }

    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { requireRole, requireOrgAccess };
