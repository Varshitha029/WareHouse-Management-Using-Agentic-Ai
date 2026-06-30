const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  // Get token from header - support both x-auth-token and Authorization
  let token = req.header('x-auth-token');
  
  if (!token) {
    token = req.header('Authorization')?.replace('Bearer ', '');
  }

  // Check if no token
  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

// Role-based middleware
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    console.log('Authorization check:', {
      userRole: req.user.role,
      requiredRoles: roles,
      userId: req.user.id,
      username: req.user.username
    });

    if (!roles.includes(req.user.role)) {
      console.log('❌ Authorization FAILED - User role:', req.user.role, 'Required roles:', roles);
      return res.status(403).json({ 
        message: 'Access denied. Insufficient permissions.',
        userRole: req.user.role,
        requiredRoles: roles
      });
    }

    console.log('✅ Authorization SUCCESS');
    next();
  };
};

module.exports.authorize = authorize;