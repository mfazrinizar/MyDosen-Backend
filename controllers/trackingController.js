const { runQuery, getOne, getAll, generateUUID } = require('../config/db');
const { checkGeofence } = require('../utils/geofence');

// Import socket manager for online status (will be set from server.js)
let getOnlineStatus = null;

/**
 * Set the online status getter function from socket manager
 * Called during server initialization
 */
const setOnlineStatusGetter = (getter) => {
  getOnlineStatus = getter;
};

/**
 * Request tracking access to a Dosen
 * Mahasiswa only endpoint
 */
const requestAccess = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { lecturer_id } = req.body;
    
    // Validate input
    if (!lecturer_id) {
      return res.status(400).json({ error: 'lecturer_id is required' });
    }
    
    // Verify the requester is a mahasiswa
    const studentProfile = await getOne(
      'SELECT user_id FROM mahasiswa WHERE user_id = ?',
      [studentId]
    );
    
    if (!studentProfile) {
      return res.status(403).json({ error: 'Only mahasiswa can request tracking access' });
    }
    
    // Verify lecturer exists in dosen table
    const lecturer = await getOne(
      'SELECT d.user_id, u.name FROM dosen d JOIN users u ON d.user_id = u.id WHERE d.user_id = ?',
      [lecturer_id]
    );
    
    if (!lecturer) {
      return res.status(404).json({ error: 'Dosen not found' });
    }
    
    // Check if request already exists
    const existingRequest = await getOne(
      'SELECT id, status FROM tracking_permissions WHERE student_id = ? AND lecturer_id = ?',
      [studentId, lecturer_id]
    );
    
    if (existingRequest) {
      return res.status(409).json({ 
        error: 'Request already exists',
        status: existingRequest.status,
        permission_id: existingRequest.id
      });
    }
    
    // Create new pending request
    const permissionId = generateUUID();
    await runQuery(
      'INSERT INTO tracking_permissions (id, student_id, lecturer_id, status) VALUES (?, ?, ?, ?)',
      [permissionId, studentId, lecturer_id, 'pending']
    );
    
    res.status(201).json({
      message: 'Access request submitted successfully',
      permission_id: permissionId,
      lecturer_name: lecturer.name
    });
    
  } catch (error) {
    console.error('Request access error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get pending tracking requests for a Dosen
 * Dosen only endpoint
 */
const getPendingRequests = async (req, res) => {
  try {
    const lecturerId = req.user.id;
    
    // Verify the requester is a dosen
    const dosenProfile = await getOne(
      'SELECT user_id FROM dosen WHERE user_id = ?',
      [lecturerId]
    );
    
    if (!dosenProfile) {
      return res.status(403).json({ error: 'Only dosen can view pending requests' });
    }
    
    // Get pending requests with student information
    const requests = await getAll(`
      SELECT 
        tp.id,
        tp.student_id,
        tp.status,
        tp.created_at,
        u.name as student_name,
        u.email as student_email,
        m.nim
      FROM tracking_permissions tp
      JOIN users u ON tp.student_id = u.id
      JOIN mahasiswa m ON tp.student_id = m.user_id
      WHERE tp.lecturer_id = ? AND tp.status = 'pending'
      ORDER BY tp.created_at DESC
    `, [lecturerId]);
    
    res.status(200).json({
      count: requests.length,
      requests: requests
    });
    
  } catch (error) {
    console.error('Get pending requests error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Handle tracking request (approve or reject)
 * Dosen only endpoint
 */
const handleRequest = async (req, res) => {
  try {
    const lecturerId = req.user.id;
    const { permission_id, action } = req.body;
    
    // Validate input
    if (!permission_id || !action) {
      return res.status(400).json({ error: 'permission_id and action are required' });
    }
    
    // Validate action
    const validActions = ['approved', 'rejected'];
    if (!validActions.includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Must be: approved or rejected' });
    }
    
    // Get the permission request
    const permission = await getOne(
      'SELECT * FROM tracking_permissions WHERE id = ?',
      [permission_id]
    );
    
    if (!permission) {
      return res.status(404).json({ error: 'Permission request not found' });
    }
    
    // Verify the lecturer owns this request
    if (permission.lecturer_id !== lecturerId) {
      return res.status(403).json({ error: 'Not authorized to handle this request' });
    }
    
    // Update the permission status
    await runQuery(
      'UPDATE tracking_permissions SET status = ? WHERE id = ?',
      [action, permission_id]
    );
    
    res.status(200).json({
      message: `Request ${action} successfully`,
      permission_id: permission_id,
      new_status: action
    });
    
  } catch (error) {
    console.error('Handle request error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get list of Mahasiswa that are allowed to track this Dosen
 * Dosen only endpoint
 */
const getAllowedMahasiswa = async (req, res) => {
  try {
    const lecturerId = req.user.id;

    // Verify the requester is a dosen
    const dosenProfile = await getOne(
      'SELECT user_id FROM dosen WHERE user_id = ?',
      [lecturerId]
    );

    if (!dosenProfile) {
      return res.status(403).json({ error: 'Only dosen can view allowed mahasiswa' });
    }

    // Get approved students with their info
    const students = await getAll(`
      SELECT
        tp.id,
        tp.student_id,
        tp.status,
        tp.created_at,
        u.name as student_name,
        u.email as student_email,
        m.nim
      FROM tracking_permissions tp
      JOIN users u ON tp.student_id = u.id
      JOIN mahasiswa m ON tp.student_id = m.user_id
      WHERE tp.lecturer_id = ? AND tp.status = 'approved'
      ORDER BY tp.created_at DESC
    `, [lecturerId]);

    // Add online status from socket manager
    const processed = students.map(s => ({
      id: s.id,
      student_id: s.student_id,
      name: s.student_name,
      email: s.student_email,
      nim: s.nim,
      status: s.status,
      requested_at: s.created_at,
    }));

    res.status(200).json({
      count: processed.length,
      students: processed
    });

  } catch (error) {
    console.error('Get allowed mahasiswa error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get list of Dosen that mahasiswa is allowed to track
 * Includes location data with geofence masking and online status
 * Mahasiswa only endpoint
 */
const getAllowedDosen = async (req, res) => {
  try {
    const studentId = req.user.id;
    
    // Verify the requester is a mahasiswa
    const studentProfile = await getOne(
      'SELECT user_id FROM mahasiswa WHERE user_id = ?',
      [studentId]
    );
    
    if (!studentProfile) {
      return res.status(403).json({ error: 'Only mahasiswa can view allowed dosen' });
    }
    
    // Get approved dosen with location data
    const approvedDosen = await getAll(`
      SELECT 
        d.user_id,
        u.name,
        d.nidn,
        l.latitude,
        l.longitude,
        l.position_name,
        l.last_updated
      FROM tracking_permissions tp
      JOIN dosen d ON tp.lecturer_id = d.user_id
      JOIN users u ON d.user_id = u.id
      LEFT JOIN locations l ON d.user_id = l.user_id
      WHERE tp.student_id = ? AND tp.status = 'approved'
      ORDER BY u.name ASC
    `, [studentId]);
    
    // Process each dosen to apply geofence masking and add online status
    const processedDosen = await Promise.all(
      approvedDosen.map(async (dosen) => {
        let locationData = {
          latitude: null,
          longitude: null,
          position_name: 'Lokasi tidak tersedia',
          last_updated: null
        };
        
        // Apply geofence masking if location exists
        if (dosen.latitude !== null && dosen.longitude !== null) {
          const geofenceResult = await checkGeofence(dosen.latitude, dosen.longitude);
          locationData = {
            latitude: geofenceResult.displayLat,
            longitude: geofenceResult.displayLong,
            position_name: geofenceResult.locationName,
            last_updated: dosen.last_updated
          };
        }
        
        // Get online status from socket manager
        const isOnline = getOnlineStatus ? getOnlineStatus(dosen.user_id) : false;
        
        return {
          user_id: dosen.user_id,
          name: dosen.name,
          nidn: dosen.nidn,
          ...locationData,
          is_online: isOnline
        };
      })
    );
    
    res.status(200).json({
      count: processedDosen.length,
      dosen: processedDosen
    });
    
  } catch (error) {
    console.error('Get allowed dosen error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get all dosen (for mahasiswa to request access)
 * Returns list without location data but includes online status
 */
const getAllDosen = async (req, res) => {
  try {
    const studentId = req.user.id;
    
    // Get all dosen with their request status for this student
    const dosenList = await getAll(`
      SELECT 
        d.user_id,
        u.name,
        d.nidn,
        tp.status as request_status,
        tp.id as permission_id
      FROM dosen d
      JOIN users u ON d.user_id = u.id
      LEFT JOIN tracking_permissions tp ON d.user_id = tp.lecturer_id AND tp.student_id = ?
      ORDER BY u.name ASC
    `, [studentId]);
    
    // Add online status from socket manager
    const dosenWithStatus = dosenList.map(dosen => ({
      ...dosen,
      is_online: getOnlineStatus ? getOnlineStatus(dosen.user_id) : false
    }));
    
    res.status(200).json({
      count: dosenWithStatus.length,
      dosen: dosenWithStatus
    });
    
  } catch (error) {
    console.error('Get all dosen error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get my tracking requests (for mahasiswa)
 */
const getMyRequests = async (req, res) => {
  try {
    const studentId = req.user.id;
    
    const requests = await getAll(`
      SELECT 
        tp.id,
        tp.lecturer_id,
        tp.status,
        tp.created_at,
        u.name as lecturer_name,
        d.nidn
      FROM tracking_permissions tp
      JOIN users u ON tp.lecturer_id = u.id
      JOIN dosen d ON tp.lecturer_id = d.user_id
      WHERE tp.student_id = ?
      ORDER BY tp.created_at DESC
    `, [studentId]);
    
    res.status(200).json({
      count: requests.length,
      requests: requests
    });
    
  } catch (error) {
    console.error('Get my requests error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get location history for dosen (last 7 days, by day of week)
 * Accessible by:
 * - Dosen: Get their own history
 * - Mahasiswa: Get history of approved dosen (requires dosen_id query param)
 */
const getLocationHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    let dosenId;
    let dosenName;

    if (userRole === 'dosen') {
      // Dosen getting their own history
      dosenId = userId;
      dosenName = req.user.name;
    } else if (userRole === 'mahasiswa') {
      // Mahasiswa getting a dosen's history
      const requestedDosenId = req.query.dosen_id;
      
      if (!requestedDosenId) {
        return res.status(400).json({ error: 'dosen_id query parameter is required for mahasiswa' });
      }

      // Verify mahasiswa has approved permission to track this dosen
      const permission = await getOne(
        `SELECT id FROM tracking_permissions 
         WHERE student_id = ? AND lecturer_id = ? AND status = 'approved'`,
        [userId, requestedDosenId]
      );

      if (!permission) {
        return res.status(403).json({ 
          error: 'Access denied. You do not have permission to view this dosen\'s history.' 
        });
      }

      // Get dosen info
      const dosen = await getOne(
        'SELECT u.name FROM users u JOIN dosen d ON u.id = d.user_id WHERE d.user_id = ?',
        [requestedDosenId]
      );

      if (!dosen) {
        return res.status(404).json({ error: 'Dosen not found' });
      }

      dosenId = requestedDosenId;
      dosenName = dosen.name;
    } else {
      return res.status(403).json({ error: 'Only dosen and mahasiswa can view location history' });
    }

    // Get history logs for all days
    const history = await getAll(`
      SELECT 
        day_of_week,
        location_name,
        latitude,
        longitude,
        logged_at
      FROM location_history
      WHERE dosen_id = ?
      ORDER BY day_of_week ASC, logged_at DESC
    `, [dosenId]);

    // Group by day of week, keeping ALL logs for each day
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const historyByDay = {};

    // Initialize all days
    for (let day = 0; day < 7; day++) {
      historyByDay[day] = [];
    }

    // Group logs by day of week
    history.forEach(log => {
      historyByDay[log.day_of_week].push({
        location_name: log.location_name,
        latitude: log.latitude,
        longitude: log.longitude,
        logged_at: log.logged_at
      });
    });

    // Format response with all 7 days
    const formattedHistory = [];
    for (let day = 0; day < 7; day++) {
      formattedHistory.push({
        day_of_week: day,
        day_name: dayNames[day],
        logs: historyByDay[day] // Array of all logs for this day
      });
    }

    res.status(200).json({
      dosen_id: dosenId,
      dosen_name: dosenName,
      history: formattedHistory
    });

  } catch (error) {
    console.error('Get location history error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  requestAccess,
  getPendingRequests,
  handleRequest,
  getAllowedDosen,
  getAllowedMahasiswa,
  getAllDosen,
  getMyRequests,
  getLocationHistory,
  setOnlineStatusGetter
};
