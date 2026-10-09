import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';

export const authenticate = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. Authentication token required.'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Query active user state from persistent database
    const userResult = await query(
      `SELECT u.id, u.email, u.full_name, u.phone, u.status, u.preferred_language 
       FROM users u 
       WHERE u.id = $1`,
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Account not found. Active session revoked.'
      });
    }

    const user = userResult.rows[0];

    // Check account status
    if (user.status === 'suspended') {
      return res.status(403).json({
        success: false,
        message: 'Account has been suspended. Please contact the Super Administrator.'
      });
    }

    if (user.status === 'deactivated') {
      return res.status(403).json({
        success: false,
        message: 'Account has been deactivated. Access revoked.'
      });
    }

    // Fetch user roles
    const rolesResult = await query(
      `SELECT r.name, r.display_name 
       FROM user_roles ur
       JOIN roles r ON ur.role_id = r.id
       WHERE ur.user_id = $1`,
      [user.id]
    );
    const roles = rolesResult.rows.map(r => r.name);

    // Fetch role-level permissions
    const rolePermissionsResult = await query(
      `SELECT DISTINCT p.code 
       FROM user_roles ur
       JOIN role_permissions rp ON ur.role_id = rp.role_id
       JOIN permissions p ON rp.permission_id = p.id
       WHERE ur.user_id = $1`,
      [user.id]
    );
    const rolePermissions = rolePermissionsResult.rows.map(p => p.code);

    // Fetch custom granted/revoked permissions
    const userPermissionsResult = await query(
      `SELECT p.code, up.is_granted 
       FROM user_permissions up
       JOIN permissions p ON up.permission_id = p.id
       WHERE up.user_id = $1`,
      [user.id]
    );

    const permissionSet = new Set(rolePermissions);
    for (const up of userPermissionsResult.rows) {
      if (up.is_granted) {
        permissionSet.add(up.code);
      } else {
        permissionSet.delete(up.code);
      }
    }

    // Fetch delegated administrator assignment (if any)
    const adminAssignResult = await query(
      `SELECT id, role_type, department_id, scope_details, is_cmo, is_active 
       FROM administrator_assignments 
       WHERE user_id = $1 AND is_active = true`,
      [user.id]
    );
    const adminAssignment = adminAssignResult.rows[0] || null;

    // Fetch staff assignment (if any)
    const staffAssignResult = await query(
      `SELECT id, staff_category, department_id, assigned_area, is_active 
       FROM staff_assignments 
       WHERE user_id = $1 AND is_active = true`,
      [user.id]
    );
    const staffAssignment = staffAssignResult.rows[0] || null;

    req.user = {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      phone: user.phone,
      status: user.status,
      roles,
      permissions: Array.from(permissionSet),
      adminAssignment,
      staffAssignment,
      isSuperAdmin: roles.includes('super_admin'),
      isCMO: roles.includes('cmo') || (adminAssignment && adminAssignment.is_cmo),
      preferredLanguage: user.preferred_language || 'en'
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Session token expired. Please log in again.'
      });
    }
    return res.status(403).json({
      success: false,
      message: 'Invalid or forged authentication token.'
    });
  }
};

export const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthenticated' });
    }

    // Super Admin has universal access
    if (req.user.isSuperAdmin) {
      return next();
    }

    const hasRole = req.user.roles.some(role => allowedRoles.includes(role));
    if (!hasRole) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Requires one of [${allowedRoles.join(', ')}] role authority.`
      });
    }

    next();
  };
};

export const requirePermission = (permissionCode) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthenticated' });
    }

    // Super Admin bypasses individual permission gates
    if (req.user.isSuperAdmin) {
      return next();
    }

    if (!req.user.permissions.includes(permissionCode)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Missing required permission [${permissionCode}].`
      });
    }

    next();
  };
};

export const requireCMO = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Unauthenticated' });
  }

  if (req.user.isSuperAdmin || req.user.isCMO || req.user.roles?.includes('delegated_admin')) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'Forbidden: Access restricted exclusively to the Super Admin-appointed Complaint Management Officer.'
  });
};

export const optionalAuthenticate = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return next();
  }
  try {
    return await authenticate(req, res, next);
  } catch (err) {
    // If token error, continue without user rather than blocking public read
    return next();
  }
};

export const authenticateToken = authenticate;

