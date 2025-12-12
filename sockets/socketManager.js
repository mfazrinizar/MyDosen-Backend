const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/authMiddleware');
const { getOne, runQuery } = require('../config/db');
const { checkGeofence } = require('../utils/geofence');

// In-memory storage for online dosen status (dosenId -> socket count)
const onlineDosenMap = new Map();

// Generic in-memory storage for online users (userId -> socket count)
const onlineUsersMap = new Map();

// In-memory storage for last location save timestamps (userId -> timestamp)
const lastSaveTimestamps = new Map();

// Throttle interval for database writes (60 seconds)
const LOCATION_SAVE_THROTTLE_MS = 60000;

// Throttle interval for location logging (3600000 ms = 1 hour)
const LOCATION_LOG_THROTTLE_MS = 3600000;

/**
 * Get online status for a dosen
 * @param {number} dosenId - The dosen user ID
 * @returns {boolean} Whether the dosen is online
 */
const isDosenOnline = (dosenId) => {
  const socketCount = onlineDosenMap.get(dosenId);
  return socketCount !== undefined && socketCount > 0;
};

/**
 * Get online status for any user (dosen or mahasiswa)
 * @param {number} userId - The user ID
 * @returns {boolean}
 */
const isUserOnline = (userId) => {
  const socketCount = onlineUsersMap.get(userId);
  return socketCount !== undefined && socketCount > 0;
};

/**
 * Initialize Socket.IO with authentication and event handlers
 * @param {Server} io - Socket.IO server instance
 */
const initSockets = (io) => {
  // Socket.IO authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      
      if (!token) {
        return next(new Error('Authentication token required'));
      }
      
      // Verify JWT token
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.user = decoded;
      
      // Verify user exists and get role
      const user = await getOne('SELECT id, name FROM users WHERE id = ?', [decoded.id]);
      
      if (!user) {
        return next(new Error('User not found'));
      }
      
      socket.user.name = user.name;
      next();
      
    } catch (error) {
      console.error('Socket authentication error:', error.message);
      next(new Error('Invalid authentication token'));
    }
  });

  io.on('connection', async (socket) => {
    const user = socket.user;
    console.log(`User connected: ${user.name} (ID: ${user.id}, Role: ${user.role})`);

    // Handle Dosen connection
    if (user.role === 'dosen') {
      handleDosenConnection(io, socket, user);
    }
    
    // Handle Mahasiswa connection
    if (user.role === 'mahasiswa') {
      handleMahasiswaConnection(io, socket, user);
    }

    // Handle location update event (from Dosen)
    socket.on('update_location', async (data) => {
      await handleLocationUpdate(io, socket, user, data);
    });

    // Handle join room request (for Mahasiswa to track Dosen)
    socket.on('join_dosen_room', async (data) => {
      await handleJoinDosenRoom(io, socket, user, data);
    });

    // Handle leave room request
    socket.on('leave_dosen_room', (data) => {
      const dosenId = data.dosenId ?? data.dosen_id;
      if (dosenId) {
        socket.leave(`room:dosen_${dosenId}`);
        console.log(`${user.name} left room: room:dosen_${dosenId}`);
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      handleDisconnect(io, socket, user);
    });
  });

  console.log('Socket.IO initialized');
};

/**
 * Handle Dosen connection - join their own room and mark online
 */
const handleDosenConnection = (io, socket, user) => {
  const dosenRoom = `room:dosen_${user.id}`;
  socket.join(dosenRoom);
  
  // Update online status
  const currentCount = onlineDosenMap.get(user.id) || 0;
  onlineDosenMap.set(user.id, currentCount + 1);
  // Also update generic user online map
  const userCount = onlineUsersMap.get(user.id) || 0;
  onlineUsersMap.set(user.id, userCount + 1);
  
  // Broadcast online status if this is the first connection
  if (currentCount === 0) {
    io.emit('dosen_status', {
      dosen_id: user.id,
      name: user.name,
      is_online: true
    });
    console.log(`Dosen ${user.name} is now online`);
  }
};

/**
 * Handle Mahasiswa connection
 */
const handleMahasiswaConnection = async (io, socket, user) => {
  // Mahasiswa can join rooms of approved dosen
  console.log(`Mahasiswa ${user.name} connected`);
  // Track mahasiswa online count in generic map
  const userCount = onlineUsersMap.get(user.id) || 0;
  onlineUsersMap.set(user.id, userCount + 1);
};

/**
 * Handle location update from Dosen
 */
const handleLocationUpdate = async (io, socket, user, data) => {
  try {
    // Only dosen can update their location
    if (user.role !== 'dosen') {
      socket.emit('error', { message: 'Only dosen can update location' });
      return;
    }

    // Accept both formats: {lat, long} or {latitude, longitude}
    const lat = data.lat ?? data.latitude;
    const long = data.long ?? data.longitude;
    
    if (lat === undefined || long === undefined) {
      socket.emit('error', { message: 'Latitude and longitude are required' });
      return;
    }

    // Validate coordinates
    if (typeof lat !== 'number' || typeof long !== 'number') {
      socket.emit('error', { message: 'Invalid coordinate format' });
      return;
    }

    // Step A: Check geofence and apply privacy masking
    const geofenceResult = await checkGeofence(lat, long);
    
    // Step B: Broadcast to room immediately with processed coordinates
    const locationData = {
      dosen_id: user.id,
      name: user.name,
      latitude: geofenceResult.displayLat,
      longitude: geofenceResult.displayLong,
      position_name: geofenceResult.locationName,
      is_inside: geofenceResult.isInside,
      last_updated: new Date().toISOString()
    };
    
    io.to(`room:dosen_${user.id}`).emit('dosen_moved', locationData);
    
    // Step C: Persist to database with throttling (60 second minimum interval)
    const now = Date.now();
    const lastSave = lastSaveTimestamps.get(user.id) || 0;
    
    if (now - lastSave >= LOCATION_SAVE_THROTTLE_MS) {
      await saveLocation(user.id, geofenceResult);
      lastSaveTimestamps.set(user.id, now);
      console.log(`Location saved for dosen ${user.id}`);
    }

    // Step D: Log to history (on-campus only)
    await logLocationToHistory(user.id, geofenceResult);

    // Acknowledge the update
    socket.emit('location_updated', { 
      success: true, 
      processed: locationData 
    });

  } catch (error) {
    console.error('Location update error:', error.message);
    socket.emit('error', { message: 'Failed to update location' });
  }
};

/**
 * Save location to database with throttling (60 seconds)
 */
const saveLocation = async (userId, geofenceResult) => {
  try {
    // Check if location record exists
    const existing = await getOne('SELECT user_id FROM locations WHERE user_id = ?', [userId]);
    
    if (existing) {
      // Update existing record
      await runQuery(
        `UPDATE locations 
         SET latitude = ?, longitude = ?, position_name = ?, last_updated = CURRENT_TIMESTAMP 
         WHERE user_id = ?`,
        [geofenceResult.displayLat, geofenceResult.displayLong, geofenceResult.locationName, userId]
      );
    } else {
      // Insert new record
      await runQuery(
        `INSERT INTO locations (user_id, latitude, longitude, position_name) 
         VALUES (?, ?, ?, ?)`,
        [userId, geofenceResult.displayLat, geofenceResult.displayLong, geofenceResult.locationName]
      );
    }
  } catch (error) {
    console.error('Error saving location:', error.message);
  }
};

/**
 * Log location to history (logs if 1 hour passed OR location changed)
 */
const logLocationToHistory = async (userId, geofenceResult) => {
  try {
    // Only log if on campus (skip "Di Luar Kampus")
    if (!geofenceResult.isInside) {
      console.log(`Skipping history log for dosen ${userId} - outside campus`);
      return;
    }

    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
    const today = now.toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Get the most recent log for this dosen on this day of week today
    const lastLog = await getOne(
      `SELECT location_name, logged_at FROM location_history 
       WHERE dosen_id = ? AND day_of_week = ? AND logged_date = ?
       ORDER BY logged_at DESC LIMIT 1`,
      [userId, dayOfWeek, today]
    );

    let shouldLog = false;
    let reason = '';

    if (!lastLog) {
      // No log for today yet
      shouldLog = true;
      reason = 'first log for today';
    } else {
      const lastLogTime = new Date(lastLog.logged_at + 'Z').getTime(); 
      const timeSinceLastLog = now.getTime() - lastLogTime;
      
      // Check if location name changed
      const locationChanged = lastLog.location_name !== geofenceResult.locationName;
      
      // Check if 1 hour has passed
      const hourPassed = timeSinceLastLog >= LOCATION_LOG_THROTTLE_MS;

      if (locationChanged) {
        shouldLog = true;
        reason = `location changed from "${lastLog.location_name}" to "${geofenceResult.locationName}"`;
      } else if (hourPassed) {
        shouldLog = true;
        reason = `1 hour passed (${Math.round(timeSinceLastLog / 60000)} min)`;
      } else {
        console.log(`Skipping history log for dosen ${userId} - same location and only ${Math.round(timeSinceLastLog / 60000)} min since last log`);
      }
    }

    if (shouldLog) {
      // Always insert new history log
      const { v4: uuidv4 } = require('uuid');
      await runQuery(
        `INSERT INTO location_history (id, dosen_id, day_of_week, location_name, latitude, longitude, logged_date)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), userId, dayOfWeek, geofenceResult.locationName, geofenceResult.displayLat, geofenceResult.displayLong, today]
      );
      console.log(`Logged location for dosen ${userId} on day ${dayOfWeek} (${today}) - ${reason}`);
    }

  } catch (error) {
    console.error('Error logging location to history:', error.message);
  }
};

/**
 * Handle Mahasiswa joining a Dosen's room
 */
const handleJoinDosenRoom = async (io, socket, user, data) => {
  try {
    // Only mahasiswa can join dosen rooms
    if (user.role !== 'mahasiswa') {
      socket.emit('error', { message: 'Only mahasiswa can join dosen tracking rooms' });
      return;
    }

    // Accept both formats: {dosenId} or {dosen_id}
    const dosenId = data.dosenId ?? data.dosen_id;
    
    if (!dosenId) {
      socket.emit('error', { message: 'dosen_id is required' });
      return;
    }

    // Verify mahasiswa has approved permission to track this dosen
    const permission = await getOne(
      `SELECT id FROM tracking_permissions 
       WHERE student_id = ? AND lecturer_id = ? AND status = 'approved'`,
      [user.id, dosenId]
    );

    if (!permission) {
      socket.emit('error', { 
        message: 'Access denied. You do not have permission to track this dosen.' 
      });
      return;
    }

    // Join the dosen's room
    const roomName = `room:dosen_${dosenId}`;
    socket.join(roomName);
    
    // Get dosen info
    const dosen = await getOne('SELECT name FROM users WHERE id = ?', [dosenId]);
    const dosenName = dosen?.name || 'Unknown';
    
    // Send current dosen status ONLY to this mahasiswa (not broadcast)
    const isOnline = isUserOnline(dosenId);
    socket.emit('dosen_status', {
      dosen_id: dosenId,
      name: dosenName,
      is_online: isOnline
    });
    
    // If dosen is online, also send their last known location to this mahasiswa
    if (isOnline) {
      const location = await getOne(
        'SELECT latitude, longitude, position_name, last_updated FROM locations WHERE user_id = ?',
        [dosenId]
      );
      if (location) {
        socket.emit('dosen_moved', {
          dosen_id: dosenId,
          name: dosenName,
          latitude: location.latitude,
          longitude: location.longitude,
          position_name: location.position_name,
          last_updated: location.last_updated
        });
      }
    }
    
    socket.emit('room_joined', { 
      dosen_id: dosenId, 
      room: roomName,
      message: 'Successfully joined tracking room' 
    });
    
    console.log(`${user.name} joined room: ${roomName}`);

  } catch (error) {
    console.error('Join room error:', error.message);
    socket.emit('error', { message: 'Failed to join room' });
  }
};

/**
 * Handle socket disconnect
 */
const handleDisconnect = (io, socket, user) => {
  console.log(`User disconnected: ${user.name} (ID: ${user.id})`);
  
  // Update dosen online status
  if (user.role === 'dosen') {
    const currentCount = onlineDosenMap.get(user.id) || 0;
    const newCount = Math.max(0, currentCount - 1);
    
    if (newCount === 0) {
      onlineDosenMap.delete(user.id);
      
      // Broadcast offline status
      io.emit('dosen_status', {
        dosen_id: user.id,
        name: user.name,
        is_online: false
      });
      console.log(`Dosen ${user.name} is now offline`);
    } else {
      onlineDosenMap.set(user.id, newCount);
    }
  }

  // Update generic user online map for all users (dosen or mahasiswa)
  const currentUserCount = onlineUsersMap.get(user.id) || 0;
  const newUserCount = Math.max(0, currentUserCount - 1);
  if (newUserCount === 0) {
    onlineUsersMap.delete(user.id);
  } else {
    onlineUsersMap.set(user.id, newUserCount);
  }
};

module.exports = {
  initSockets,
  isDosenOnline,
  isUserOnline
};
