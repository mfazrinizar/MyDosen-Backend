const { getAll } = require('../config/db');

// Jakarta coordinates for privacy masking
const MASKED_LOCATION = {
  latitude: -6.2088,
  longitude: 106.8456,
  locationName: 'Di Luar'
};

/**
 * Calculate Haversine distance between two coordinates
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in kilometers
 */
const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
};

/**
 * Convert degrees to radians
 * @param {number} deg - Degrees
 * @returns {number} Radians
 */
const toRad = (deg) => {
  return deg * (Math.PI / 180);
};

/**
 * Check if coordinates are within any defined geofence
 * @param {number} lat - Latitude to check
 * @param {number} long - Longitude to check
 * @returns {Promise<Object>} Geofence check result with privacy masking applied
 */
const checkGeofence = async (lat, long) => {
  try {
    // Get all geofences from database
    const geofences = await getAll('SELECT * FROM geofences');
    
    // Check if coordinates are inside any geofence
    for (const geofence of geofences) {
      const distance = haversineDistance(lat, long, geofence.latitude, geofence.longitude);
      
      if (distance <= geofence.radius_km) {
        // Inside geofence - return actual coordinates
        return {
          isInside: true,
          locationName: geofence.name,
          displayLat: lat,
          displayLong: long
        };
      }
    }
    
    // Outside all geofences - apply privacy masking
    return {
      isInside: false,
      locationName: MASKED_LOCATION.locationName,
      displayLat: MASKED_LOCATION.latitude,
      displayLong: MASKED_LOCATION.longitude
    };
    
  } catch (error) {
    console.error('Error checking geofence:', error.message);
    // On error, apply privacy masking for safety
    return {
      isInside: false,
      locationName: MASKED_LOCATION.locationName,
      displayLat: MASKED_LOCATION.latitude,
      displayLong: MASKED_LOCATION.longitude
    };
  }
};

/**
 * Get masked location (for use when privacy protection is needed)
 * @returns {Object} Masked location coordinates
 */
const getMaskedLocation = () => {
  return { ...MASKED_LOCATION };
};

module.exports = {
  checkGeofence,
  getMaskedLocation,
  haversineDistance
};
