const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { getOne } = require('../config/db');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../middleware/authMiddleware');

/**
 * Login controller
 * Validates credentials and issues JWT token
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Sanitize email input
    const sanitizedEmail = String(email).trim().toLowerCase();
    
    // Find user by email (parameterized query for SQL injection protection)
    const user = await getOne(
      'SELECT id, name, email, password_hash FROM users WHERE email = ?',
      [sanitizedEmail]
    );
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Verify password with bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Determine user role by checking profile tables
    let role = null;
    
    const adminProfile = await getOne('SELECT * FROM admin WHERE user_id = ?', [user.id]);
    if (adminProfile) {
      role = 'admin';
    }
    
    if (!role) {
      const dosenProfile = await getOne('SELECT * FROM dosen WHERE user_id = ?', [user.id]);
      if (dosenProfile) {
        role = 'dosen';
      }
    }
    
    if (!role) {
      const mahasiswaProfile = await getOne('SELECT * FROM mahasiswa WHERE user_id = ?', [user.id]);
      if (mahasiswaProfile) {
        role = 'mahasiswa';
      }
    }
    
    if (!role) {
      return res.status(403).json({ error: 'User has no assigned role' });
    }
    
    // Generate JWT token
    const tokenPayload = {
      id: user.id,
      role: role,
      name: user.name
    };
    
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    
    // Return success response
    res.status(200).json({
      message: 'Login successful',
      token: token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: role
      }
    });
    
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ error: 'Internal server error during login' });
  }
};

/**
 * Get current user profile
 * Requires authentication
 */
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = await getOne(
      'SELECT id, name, email, created_at FROM users WHERE id = ?',
      [userId]
    );
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get role-specific data
    let profileData = null;
    const role = req.user.role;
    
    if (role === 'admin') {
      profileData = await getOne('SELECT nip FROM admin WHERE user_id = ?', [userId]);
    } else if (role === 'dosen') {
      profileData = await getOne('SELECT nidn FROM dosen WHERE user_id = ?', [userId]);
    } else if (role === 'mahasiswa') {
      profileData = await getOne('SELECT nim FROM mahasiswa WHERE user_id = ?', [userId]);
    }
    
    res.status(200).json({
      user: {
        ...user,
        role: role,
        ...profileData
      }
    });
    
  } catch (error) {
    console.error('Get profile error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  login,
  getProfile
};
