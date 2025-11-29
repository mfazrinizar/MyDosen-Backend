const bcrypt = require('bcrypt');
const { runQuery, getOne, getAll, generateUUID } = require('../config/db');

/**
 * Create a new user (admin, dosen, or mahasiswa)
 * Admin only endpoint
 */
const createUser = async (req, res) => {
  try {
    const { name, email, password, role, nim, nidn, nip } = req.body;
    
    // Validate required fields
    if (!name || !email || !password || !role) {
      return res.status(400).json({ 
        error: 'Name, email, password, and role are required' 
      });
    }
    
    // Validate role
    const validRoles = ['admin', 'dosen', 'mahasiswa'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ 
        error: 'Invalid role. Must be: admin, dosen, or mahasiswa' 
      });
    }
    
    // Validate role-specific required fields
    if (role === 'mahasiswa' && !nim) {
      return res.status(400).json({ error: 'NIM is required for mahasiswa' });
    }
    if (role === 'dosen' && !nidn) {
      return res.status(400).json({ error: 'NIDN is required for dosen' });
    }
    if (role === 'admin' && !nip) {
      return res.status(400).json({ error: 'NIP is required for admin' });
    }
    
    // Sanitize inputs
    const sanitizedEmail = String(email).trim().toLowerCase();
    const sanitizedName = String(name).trim();
    
    // Check if email already exists
    const existingUser = await getOne(
      'SELECT id FROM users WHERE email = ?',
      [sanitizedEmail]
    );
    
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    
    // Check for duplicate nim/nidn/nip
    if (role === 'mahasiswa') {
      const existingNim = await getOne('SELECT user_id FROM mahasiswa WHERE nim = ?', [nim]);
      if (existingNim) {
        return res.status(409).json({ error: 'NIM already registered' });
      }
    } else if (role === 'dosen') {
      const existingNidn = await getOne('SELECT user_id FROM dosen WHERE nidn = ?', [nidn]);
      if (existingNidn) {
        return res.status(409).json({ error: 'NIDN already registered' });
      }
    } else if (role === 'admin') {
      const existingNip = await getOne('SELECT user_id FROM admin WHERE nip = ?', [nip]);
      if (existingNip) {
        return res.status(409).json({ error: 'NIP already registered' });
      }
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Generate UUID for the new user
    const userId = generateUUID();
    
    // Insert user into users table
    await runQuery(
      'INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)',
      [userId, sanitizedName, sanitizedEmail, passwordHash]
    );
    
    // Insert into role-specific profile table
    if (role === 'mahasiswa') {
      await runQuery(
        'INSERT INTO mahasiswa (user_id, nim) VALUES (?, ?)',
        [userId, nim]
      );
    } else if (role === 'dosen') {
      await runQuery(
        'INSERT INTO dosen (user_id, nidn) VALUES (?, ?)',
        [userId, nidn]
      );
    } else if (role === 'admin') {
      await runQuery(
        'INSERT INTO admin (user_id, nip) VALUES (?, ?)',
        [userId, nip]
      );
    }
    
    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: userId,
        name: sanitizedName,
        email: sanitizedEmail,
        role: role
      }
    });
    
  } catch (error) {
    console.error('Create user error:', error.message);
    res.status(500).json({ error: 'Internal server error while creating user' });
  }
};

/**
 * Force assign tracking permission (set status to approved)
 * Admin only endpoint
 */
const forceAssignPermission = async (req, res) => {
  try {
    const { student_id, lecturer_id } = req.body;
    
    // Validate input
    if (!student_id || !lecturer_id) {
      return res.status(400).json({ 
        error: 'student_id and lecturer_id are required' 
      });
    }
    
    // Verify student exists in mahasiswa table
    const student = await getOne(
      'SELECT user_id FROM mahasiswa WHERE user_id = ?',
      [student_id]
    );
    
    if (!student) {
      return res.status(404).json({ error: 'Student (mahasiswa) not found' });
    }
    
    // Verify lecturer exists in dosen table
    const lecturer = await getOne(
      'SELECT user_id FROM dosen WHERE user_id = ?',
      [lecturer_id]
    );
    
    if (!lecturer) {
      return res.status(404).json({ error: 'Lecturer (dosen) not found' });
    }
    
    // Check if permission already exists
    const existingPermission = await getOne(
      'SELECT id, status FROM tracking_permissions WHERE student_id = ? AND lecturer_id = ?',
      [student_id, lecturer_id]
    );
    
    if (existingPermission) {
      // Update existing permission to approved
      await runQuery(
        'UPDATE tracking_permissions SET status = ? WHERE id = ?',
        ['approved', existingPermission.id]
      );
      
      return res.status(200).json({
        message: 'Permission updated to approved',
        permission_id: existingPermission.id
      });
    }
    
    // Insert new permission with approved status
    const permissionId = generateUUID();
    await runQuery(
      'INSERT INTO tracking_permissions (id, student_id, lecturer_id, status) VALUES (?, ?, ?, ?)',
      [permissionId, student_id, lecturer_id, 'approved']
    );
    
    res.status(201).json({
      message: 'Permission created and approved',
      permission_id: permissionId
    });
    
  } catch (error) {
    console.error('Force assign permission error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get all users with their role information
 * Admin only endpoint
 */
const getAllUsers = async (req, res) => {
  try {
    // Get all users with role information using LEFT JOINs
    const users = await getAll(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.created_at,
        CASE 
          WHEN a.user_id IS NOT NULL THEN 'admin'
          WHEN d.user_id IS NOT NULL THEN 'dosen'
          WHEN m.user_id IS NOT NULL THEN 'mahasiswa'
          ELSE 'unknown'
        END as role,
        a.nip,
        d.nidn,
        m.nim
      FROM users u
      LEFT JOIN admin a ON u.id = a.user_id
      LEFT JOIN dosen d ON u.id = d.user_id
      LEFT JOIN mahasiswa m ON u.id = m.user_id
      ORDER BY u.created_at DESC
    `);
    
    res.status(200).json({
      count: users.length,
      users: users
    });
    
  } catch (error) {
    console.error('Get all users error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Delete a user by ID
 * Admin only endpoint
 */
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    // Check if user exists
    const user = await getOne('SELECT id, email FROM users WHERE id = ?', [id]);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Prevent deleting the requester's own account
    if (id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    
    // Delete user (cascades to profile tables due to foreign keys)
    await runQuery('DELETE FROM users WHERE id = ?', [id]);
    
    res.status(200).json({
      message: 'User deleted successfully',
      deleted_user_id: id
    });
    
  } catch (error) {
    console.error('Delete user error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get all tracking permissions
 * Admin only endpoint
 */
const getAllPermissions = async (req, res) => {
  try {
    const permissions = await getAll(`
      SELECT 
        tp.id,
        tp.student_id,
        tp.lecturer_id,
        tp.status,
        tp.created_at,
        us.name as student_name,
        m.nim,
        ul.name as lecturer_name,
        d.nidn
      FROM tracking_permissions tp
      JOIN users us ON tp.student_id = us.id
      JOIN mahasiswa m ON tp.student_id = m.user_id
      JOIN users ul ON tp.lecturer_id = ul.id
      JOIN dosen d ON tp.lecturer_id = d.user_id
      ORDER BY tp.created_at DESC
    `);
    
    res.status(200).json({
      count: permissions.length,
      permissions: permissions
    });
    
  } catch (error) {
    console.error('Get all permissions error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  createUser,
  forceAssignPermission,
  getAllUsers,
  deleteUser,
  getAllPermissions
};
