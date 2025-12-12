const swaggerJsdoc = require('swagger-jsdoc');

const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3010}`;

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'MyDosen API',
      version: '1.0.0',
      description: 'University Location Tracking System API - Track Dosen locations in real-time',
      contact: {
        name: 'MyDosen Support',
        email: 'support@mydosen.unsri.ac.id'
      }
    },
    servers: [
      {
        url: `${BASE_URL}/api/v1`,
        description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' },
            name: { type: 'string', example: 'John Doe' },
            email: { type: 'string', format: 'email', example: 'john@unsri.ac.id' },
            created_at: { type: 'string', format: 'date-time' }
          }
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'admin@unsri.ac.id' },
            password: { type: 'string', example: 'admin123' }
          }
        },
        LoginResponse: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Login successful' },
            token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' },
                name: { type: 'string', example: 'Administrator' },
                role: { type: 'string', enum: ['admin', 'dosen', 'mahasiswa'], example: 'admin' }
              }
            }
          }
        },
        CreateUserRequest: {
          type: 'object',
          required: ['name', 'email', 'password', 'role'],
          properties: {
            name: { type: 'string', example: 'Dr. Jane Smith' },
            email: { type: 'string', format: 'email', example: 'jane@unsri.ac.id' },
            password: { type: 'string', example: 'password123' },
            role: { type: 'string', enum: ['dosen', 'mahasiswa', 'admin'], example: 'dosen' },
            nim: { type: 'string', description: 'Required for mahasiswa', example: '09021182126002' },
            nidn: { type: 'string', description: 'Required for dosen', example: '0001018502' },
            nip: { type: 'string', description: 'Required for admin', example: '199001012020011002' }
          }
        },
        TrackingPermission: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440001' },
            student_id: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440002' },
            lecturer_id: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440003' },
            status: { type: 'string', enum: ['pending', 'approved', 'rejected'], example: 'pending' },
            created_at: { type: 'string', format: 'date-time' }
          }
        },
        RequestAccessRequest: {
          type: 'object',
          required: ['lecturer_id'],
          properties: {
            lecturer_id: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440003' }
          }
        },
        HandleRequestRequest: {
          type: 'object',
          required: ['permission_id', 'action'],
          properties: {
            permission_id: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440001' },
            action: { type: 'string', enum: ['approved', 'rejected'], example: 'approved' }
          }
        },
        DosenLocation: {
          type: 'object',
          properties: {
            user_id: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440003' },
            name: { type: 'string', example: 'Dr. Budi Santoso' },
            nidn: { type: 'string', example: '0001018501' },
            latitude: { type: 'number', format: 'double', example: -3.219 },
            longitude: { type: 'number', format: 'double', example: 104.64 },
            position_name: { type: 'string', example: 'UNSRI Indralaya' },
            is_online: { type: 'boolean', example: true },
            last_updated: { type: 'string', format: 'date-time' }
          }
        },
        MahasiswaInfo: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440010' },
            student_id: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440002' },
            name: { type: 'string', example: 'Ahmad Santoso' },
            email: { type: 'string', format: 'email', example: 'ahmad@unsri.ac.id' },
            nim: { type: 'string', example: '09021182126002' },
            status: { type: 'string', enum: ['pending', 'approved', 'rejected'], example: 'approved' },
            requested_at: { type: 'string', format: 'date-time' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Error message' }
          }
        },
        Success: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Operation successful' }
          }
        },
        // Socket.IO Schemas
        UpdateLocationPayload: {
          type: 'object',
          required: ['latitude', 'longitude'],
          properties: {
            latitude: { type: 'number', format: 'double', example: -3.2195, description: 'Latitude coordinate' },
            longitude: { type: 'number', format: 'double', example: 104.6477, description: 'Longitude coordinate' }
          }
        },
        JoinRoomPayload: {
          type: 'object',
          required: ['dosen_id'],
          properties: {
            dosen_id: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440003', description: 'UUID of the Dosen to track' }
          }
        },
        LeaveRoomPayload: {
          type: 'object',
          required: ['dosen_id'],
          properties: {
            dosen_id: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440003', description: 'UUID of the Dosen to stop tracking' }
          }
        },
        DosenMovedPayload: {
          type: 'object',
          properties: {
            dosen_id: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440003' },
            latitude: { type: 'number', format: 'double', example: -3.2195 },
            longitude: { type: 'number', format: 'double', example: 104.6477 },
            position_name: { type: 'string', example: 'UNSRI Indralaya', description: 'Campus name or "Di luar kampus" if outside geofence' },
            last_updated: { type: 'string', format: 'date-time' }
          }
        },
        DosenStatusPayload: {
          type: 'object',
          properties: {
            dosen_id: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440003' },
            is_online: { type: 'boolean', example: true, description: 'Whether the Dosen is currently connected' }
          }
        }
      }
    },
    tags: [
      { name: 'Auth', description: 'Authentication endpoints' },
      { name: 'Admin', description: 'Admin management endpoints' },
      { name: 'Tracking', description: 'Location tracking and permission endpoints' },
      { name: 'WebSocket', description: `Socket.IO real-time events documentation. Connect to ${BASE_URL.replace('http', 'ws').replace('https', 'wss')} with path /api/v1/io` }
    ],
    paths: {
      '/socket.io/connection': {
        get: {
          tags: ['WebSocket'],
          summary: 'Socket.IO Connection Info',
          description: `
## Connection Details

**Endpoint:** \`${BASE_URL.replace('http', 'ws').replace('https', 'wss')}\`  
**Path:** \`/api/v1/io\`

### Authentication
JWT token is required for connection. Pass it in the auth object:

\`\`\`javascript
const socket = io('${BASE_URL}', {
  path: '/api/v1/io',
  auth: {
    token: 'your_jwt_token_here'
  }
});
\`\`\`

### Connection Events
- \`connect\` - Fired when successfully connected
- \`disconnect\` - Fired when disconnected
- \`connect_error\` - Fired on connection error (usually auth failure)
          `,
          responses: {
            '200': {
              description: 'Connection established successfully'
            },
            '401': {
              description: 'Authentication failed - Invalid or missing token'
            }
          }
        }
      },
      '/socket.io/emit/update_location': {
        post: {
          tags: ['WebSocket'],
          summary: 'Client → Server: update_location',
          description: `
## Update Location (Dosen Only)

Dosen emits this event to update their current location. The server will:
1. Apply geofence privacy masking (coordinates outside UNSRI campuses will be masked)
2. Persist location to database (throttled to once per 60 seconds)
3. Broadcast to all students tracking this Dosen

### Emit Example
\`\`\`javascript
socket.emit('update_location', {
  latitude: -3.2195,
  longitude: 104.6477
});
\`\`\`

### Privacy Note
If the Dosen is outside UNSRI geofences (Indralaya/Palembang), their location will be masked to Jakarta coordinates (-6.2, 106.816) for privacy.
          `,
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  '$ref': '#/components/schemas/UpdateLocationPayload'
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Location updated and broadcast to tracking students'
            }
          }
        }
      },
      '/socket.io/emit/join_dosen_room': {
        post: {
          tags: ['WebSocket'],
          summary: 'Client → Server: join_dosen_room',
          description: `
## Join Dosen Room (Mahasiswa Only)

Mahasiswa emits this event to start receiving real-time location updates for a specific Dosen.

### Prerequisites
- Must have an **approved** tracking permission for the target Dosen
- Pending or rejected permissions will return an error

### Emit Example
\`\`\`javascript
socket.emit('join_dosen_room', {
  dosen_id: '550e8400-e29b-41d4-a716-446655440003'
});
\`\`\`

### Server Response
On success, the socket joins the room \`dosen_{dosen_id}\` and will receive \`dosen_moved\` and \`dosen_status\` events.
          `,
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  '$ref': '#/components/schemas/JoinRoomPayload'
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Successfully joined Dosen room'
            },
            '403': {
              description: 'No approved permission to track this Dosen'
            }
          }
        }
      },
      '/socket.io/emit/leave_dosen_room': {
        post: {
          tags: ['WebSocket'],
          summary: 'Client → Server: leave_dosen_room',
          description: `
## Leave Dosen Room

Mahasiswa emits this event to stop receiving real-time location updates for a specific Dosen.

### Emit Example
\`\`\`javascript
socket.emit('leave_dosen_room', {
  dosen_id: '550e8400-e29b-41d4-a716-446655440003'
});
\`\`\`
          `,
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  '$ref': '#/components/schemas/LeaveRoomPayload'
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Successfully left Dosen room'
            }
          }
        }
      },
      '/socket.io/on/dosen_moved': {
        get: {
          tags: ['WebSocket'],
          summary: 'Server → Client: dosen_moved',
          description: `
## Dosen Moved (Server → Client)

Server broadcasts this event to all Mahasiswa in a Dosen's room when the Dosen updates their location.

### Listen Example
\`\`\`javascript
socket.on('dosen_moved', (data) => {
  console.log('Dosen location:', data);
  // Update map marker with new coordinates
});
\`\`\`

### Geofence Behavior
- **Inside UNSRI campus:** Real coordinates returned
- **Outside UNSRI campus:** Jakarta coordinates (-6.2, 106.816) with position_name "Di luar kampus"
          `,
          responses: {
            '200': {
              description: 'Event payload received by client',
              content: {
                'application/json': {
                  schema: {
                    '$ref': '#/components/schemas/DosenMovedPayload'
                  }
                }
              }
            }
          }
        }
      },
      '/socket.io/on/dosen_status': {
        get: {
          tags: ['WebSocket'],
          summary: 'Server → Client: dosen_status',
          description: `
## Dosen Status (Server → Client)

Server broadcasts this event when a Dosen's online status changes (connects or disconnects).

### Listen Example
\`\`\`javascript
socket.on('dosen_status', (data) => {
  if (data.is_online) {
    console.log('Dosen is now online');
  } else {
    console.log('Dosen went offline');
  }
});
\`\`\`
          `,
          responses: {
            '200': {
              description: 'Event payload received by client',
              content: {
                'application/json': {
                  schema: {
                    '$ref': '#/components/schemas/DosenStatusPayload'
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  apis: ['./routes/*.js']
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
