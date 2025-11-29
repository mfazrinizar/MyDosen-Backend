const jwt = require('jsonwebtoken');
const { getOne } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'mydosen_secret_key_fallback';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

/**
 * Verify JWT token from Authorization header
 * Attaches decoded user info to req.user
 */
const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header provided' });
    }
    
    // Check for Bearer token format
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Invalid authorization format. Use: Bearer <token>' });
    }
    
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
    
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token has expired' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    return res.status(500).json({ error: 'Failed to authenticate token' });
  }
};

/**
 * Require admin role
 * Must be used after verifyToken middleware
 */
const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Check if user role from token is admin
    if (req.user.role === 'admin') {
      return next();
    }
    
    // Double-check by querying admin table
    const adminProfile = await getOne(
      'SELECT * FROM admin WHERE user_id = ?',
      [req.user.id]
    );
    
    if (!adminProfile) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    next();
    
  } catch (error) {
    console.error('Error in requireAdmin middleware:', error.message);
    return res.status(500).json({ error: 'Authorization check failed' });
  }
};

/**
 * Require dosen role
 * Must be used after verifyToken middleware
 */
const requireDosen = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (req.user.role === 'dosen') {
      return next();
    }
    
    const dosenProfile = await getOne(
      'SELECT * FROM dosen WHERE user_id = ?',
      [req.user.id]
    );
    
    if (!dosenProfile) {
      return res.status(403).json({ error: 'Dosen access required' });
    }
    
    next();
    
  } catch (error) {
    console.error('Error in requireDosen middleware:', error.message);
    return res.status(500).json({ error: 'Authorization check failed' });
  }
};

/**
 * Require mahasiswa role
 * Must be used after verifyToken middleware
 */
const requireMahasiswa = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (req.user.role === 'mahasiswa') {
      return next();
    }
    
    const mahasiswaProfile = await getOne(
      'SELECT * FROM mahasiswa WHERE user_id = ?',
      [req.user.id]
    );
    
    if (!mahasiswaProfile) {
      return res.status(403).json({ error: 'Mahasiswa access required' });
    }
    
    next();
    
  } catch (error) {
    console.error('Error in requireMahasiswa middleware:', error.message);
    return res.status(500).json({ error: 'Authorization check failed' });
  }
};

module.exports = {
  verifyToken,
  requireAdmin,
  requireDosen,
  requireMahasiswa,
  JWT_SECRET,
  JWT_EXPIRES_IN
};
