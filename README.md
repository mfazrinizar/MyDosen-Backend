# MyDosen Backend

University Location Tracking System - Backend API Server

## Overview

MyDosen is a real-time location tracking system for universities that allows Mahasiswa (students) to track the location of Dosen (lecturers) with proper permission management.

## Features

- 🔐 **JWT Authentication** - Secure user authentication with role-based access
- 👥 **Multi-role System** - Admin, Dosen, and Mahasiswa roles
- 📍 **Real-time Location Tracking** - Socket.IO for live location updates
- 🔒 **Privacy Masking** - Geofence-based location privacy protection
- 📄 **API Documentation** - Swagger/OpenAPI documentation
- 📡 **Socket.IO Documentation** - Dedicated endpoint for WebSocket docs
- 🗃️ **SQLite Database** - Lightweight and portable database
- 🆔 **UUID Primary Keys** - All IDs use UUID v4 format

## Tech Stack

- **Runtime:** Node.js + Express.js
- **Database:** SQLite (Raw SQL, no ORM)
- **Real-time:** Socket.IO
- **Authentication:** JWT + BCrypt
- **Documentation:** Swagger UI

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm

### Installation

```bash
# Clone the repository
cd MyDosen-Backend

# Install dependencies
npm install

# Start the server
npm start

# Or for development with auto-reload
npm run dev
```

### Server URLs

- **API Server:** http://localhost:3000
- **API Documentation:** http://localhost:3000/api-docs (Swagger UI)
- **Socket.IO Docs:** http://localhost:3000/socket-docs (JSON)
- **Health Check:** http://localhost:3000/health

### API Docs Credentials

- **Username:** admin
- **Password:** ADM1NC0Y

## Default Users

The system comes with seeded users for testing:

| Role      | Email                  | Password     |
| --------- | ---------------------- | ------------ |
| Admin     | admin@unsri.ac.id      | admin123     |
| Dosen     | dosen1@unsri.ac.id     | dosen123     |
| Mahasiswa | mahasiswa1@unsri.ac.id | mahasiswa123 |

## API Endpoints

### Authentication

- `POST /api/auth/login` - Login and get JWT token
- `GET /api/auth/profile` - Get current user profile

### Admin (Requires Admin Role)

- `POST /api/admin/users` - Create new user
- `GET /api/admin/users` - List all users
- `DELETE /api/admin/users/:id` - Delete a user
- `POST /api/admin/permissions` - Force assign tracking permission
- `GET /api/admin/permissions` - List all permissions

### Tracking - Mahasiswa

- `POST /api/tracking/request` - Request access to track a Dosen
- `GET /api/tracking/my-requests` - View my tracking requests
- `GET /api/tracking/allowed-dosen` - List approved Dosen with locations
- `GET /api/tracking/dosen` - List all Dosen

### Tracking - Dosen

- `GET /api/tracking/pending` - View pending tracking requests
- `POST /api/tracking/handle` - Approve/reject a request

## Socket.IO Events

> **Full documentation available at:** http://localhost:3000/socket-docs

### Client → Server

- `update_location` - Dosen updates their location `{ lat, long }`
- `join_dosen_room` - Mahasiswa joins a Dosen's room `{ dosenId }`
- `leave_dosen_room` - Leave a Dosen's room `{ dosenId }`

### Server → Client

- `dosen_moved` - Location update broadcast
- `dosen_status` - Online/offline status change
- `room_joined` - Room join confirmation
- `location_updated` - Location update acknowledgment
- `error` - Error message

### Socket Authentication

Connect with JWT token:

```javascript
const socket = io("http://localhost:3000", {
  auth: { token: "your-jwt-token" },
});
```

## Geofences

The system includes predefined geofences:

- **UNSRI Indralaya** - Lat: -3.219, Long: 104.64, Radius: 1km
- **UNSRI Palembang** - Lat: -2.980, Long: 104.73, Radius: 1km

Locations outside these geofences are masked with Jakarta coordinates for privacy.

## Project Structure

```
MyDosen-Backend/
├── config/
│   ├── db.js          # Database setup & seeding
│   └── swagger.js     # Swagger configuration
├── controllers/
│   ├── authController.js
│   ├── adminController.js
│   └── trackingController.js
├── middleware/
│   ├── authMiddleware.js  # JWT verification
│   └── docAuth.js         # Swagger Basic Auth
├── routes/
│   └── apiRoutes.js   # All API routes with Swagger docs
├── sockets/
│   └── socketManager.js  # Socket.IO logic
├── utils/
│   └── geofence.js    # Geofence utilities
├── server.js          # Entry point
└── package.json
```

## License

ISC
