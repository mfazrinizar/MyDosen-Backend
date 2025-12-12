const express = require('express');
const router = express.Router();

// Controllers
const authController = require('../controllers/authController');
const adminController = require('../controllers/adminController');
const trackingController = require('../controllers/trackingController');

// Middleware
const { verifyToken, requireAdmin, requireDosen, requireMahasiswa } = require('../middleware/authMiddleware');

// ==================== AUTH ROUTES ====================

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login to the system
 *     description: Authenticate with email and password to receive a JWT token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       400:
 *         description: Missing email or password
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/auth/login', authController.login);

/**
 * @swagger
 * /auth/profile:
 *   get:
 *     tags: [Auth]
 *     summary: Get current user profile
 *     description: Returns the profile information of the authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/auth/profile', verifyToken, authController.getProfile);

// ==================== ADMIN ROUTES ====================

/**
 * @swagger
 * /admin/users:
 *   post:
 *     tags: [Admin]
 *     summary: Create a new user
 *     description: Create a new user account (admin, dosen, or mahasiswa). Admin only.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUserRequest'
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User created successfully
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Invalid input
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Email/NIM/NIDN/NIP already registered
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/admin/users', verifyToken, requireAdmin, adminController.createUser);

/**
 * @swagger
 * /admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: Get all users
 *     description: Retrieve a list of all users with their role information. Admin only.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *                   example: 3
 *                 users:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/admin/users', verifyToken, requireAdmin, adminController.getAllUsers);

/**
 * @swagger
 * /admin/users/{id}:
 *   delete:
 *     tags: [Admin]
 *     summary: Delete a user
 *     description: Delete a user by ID. Admin only.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID (UUID) to delete
 *     responses:
 *       200:
 *         description: User deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         description: Cannot delete own account
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/admin/users/:id', verifyToken, requireAdmin, adminController.deleteUser);

/**
 * @swagger
 * /admin/permissions:
 *   post:
 *     tags: [Admin]
 *     summary: Force assign tracking permission
 *     description: Create or update a tracking permission with approved status. Admin only.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - student_id
 *               - lecturer_id
 *             properties:
 *               student_id:
 *                 type: string
 *                 format: uuid
 *                 example: '550e8400-e29b-41d4-a716-446655440002'
 *               lecturer_id:
 *                 type: string
 *                 format: uuid
 *                 example: '550e8400-e29b-41d4-a716-446655440003'
 *     responses:
 *       201:
 *         description: Permission created and approved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 permission_id:
 *                   type: string
 *                   format: uuid
 *       200:
 *         description: Existing permission updated to approved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 permission_id:
 *                   type: string
 *                   format: uuid
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Student or lecturer not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/admin/permissions', verifyToken, requireAdmin, adminController.forceAssignPermission);

/**
 * @swagger
 * /admin/permissions:
 *   get:
 *     tags: [Admin]
 *     summary: Get all tracking permissions
 *     description: Retrieve all tracking permissions with user details. Admin only.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of permissions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *                 permissions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TrackingPermission'
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/admin/permissions', verifyToken, requireAdmin, adminController.getAllPermissions);

// ==================== TRACKING ROUTES (MAHASISWA) ====================

/**
 * @swagger
 * /tracking/request:
 *   post:
 *     tags: [Tracking]
 *     summary: Request tracking access to a Dosen
 *     description: Mahasiswa requests permission to track a Dosen's location. Mahasiswa only.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RequestAccessRequest'
 *     responses:
 *       201:
 *         description: Request submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 permission_id:
 *                   type: string
 *                   format: uuid
 *                 lecturer_name:
 *                   type: string
 *       403:
 *         description: Mahasiswa access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Dosen not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Request already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/tracking/request', verifyToken, requireMahasiswa, trackingController.requestAccess);

/**
 * @swagger
 * /tracking/my-requests:
 *   get:
 *     tags: [Tracking]
 *     summary: Get my tracking requests
 *     description: Mahasiswa retrieves their tracking permission requests. Mahasiswa only.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of tracking requests
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *                 requests:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TrackingPermission'
 *       403:
 *         description: Mahasiswa access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/tracking/my-requests', verifyToken, requireMahasiswa, trackingController.getMyRequests);

/**
 * @swagger
 * /tracking/allowed-dosen:
 *   get:
 *     tags: [Tracking]
 *     summary: Get list of Dosen allowed to track
 *     description: Mahasiswa retrieves list of Dosen they have approved permission to track, including location data. Mahasiswa only.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of allowed Dosen with location data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *                 dosen:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/DosenLocation'
 *       403:
 *         description: Mahasiswa access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/tracking/allowed-dosen', verifyToken, requireMahasiswa, trackingController.getAllowedDosen);

/**
 * @swagger
 * /tracking/dosen:
 *   get:
 *     tags: [Tracking]
 *     summary: Get all Dosen
 *     description: Retrieve list of all Dosen for request purposes (without location data). Authenticated users only.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all Dosen
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *                 dosen:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       user_id:
 *                         type: string
 *                         format: uuid
 *                       name:
 *                         type: string
 *                       nidn:
 *                         type: string
 *                       request_status:
 *                         type: string
 *                         nullable: true
 */
router.get('/tracking/dosen', verifyToken, trackingController.getAllDosen);

// ==================== TRACKING ROUTES (DOSEN) ====================

/**
 * @swagger
 * /tracking/pending:
 *   get:
 *     tags: [Tracking]
 *     summary: Get pending tracking requests
 *     description: Dosen retrieves pending tracking permission requests from Mahasiswa. Dosen only.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of pending requests
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *                 requests:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       student_id:
 *                         type: string
 *                         format: uuid
 *                       student_name:
 *                         type: string
 *                       student_email:
 *                         type: string
 *                       nim:
 *                         type: string
 *                       status:
 *                         type: string
 *                       created_at:
 *                         type: string
 *       403:
 *         description: Dosen access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/tracking/pending', verifyToken, requireDosen, trackingController.getPendingRequests);

/**
 * @swagger
 * /tracking/handle:
 *   post:
 *     tags: [Tracking]
 *     summary: Handle tracking request
 *     description: Dosen approves or rejects a tracking permission request. Dosen only.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/HandleRequestRequest'
 *     responses:
 *       200:
 *         description: Request handled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 permission_id:
 *                   type: string
 *                   format: uuid
 *                   description: UUID of the permission
 *                 new_status:
 *                   type: string
 *       400:
 *         description: Invalid input
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Not authorized or Dosen access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Permission request not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/tracking/handle', verifyToken, requireDosen, trackingController.handleRequest);

/**
 * @swagger
 * /tracking/students:
 *   get:
 *     tags: [Tracking]
 *     summary: Get list of Mahasiswa allowed to track this Dosen
 *     description: Dosen retrieves a list of Mahasiswa who have approved tracking permission for them. Dosen only.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of allowed Mahasiswa
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *                 students:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/MahasiswaInfo'
 *       403:
 *         description: Dosen access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/tracking/students', verifyToken, requireDosen, trackingController.getAllowedMahasiswa);

// ==================== LOCATION HISTORY ROUTES ====================

/**
 * @swagger
 * /tracking/history:
 *   get:
 *     tags: [Tracking]
 *     summary: Get location history for dosen
 *     description: |
 *       Get location history for each day of week (Mon-Sun).
 *       Multiple logs per day are stored when:
 *       - 1 hour has passed since the last log
 *       - The dosen moved to a different on-campus location
 *       
 *       Returns ALL logs for each day of week, grouped by day.
 *       - **Dosen**: Get their own history
 *       - **Mahasiswa**: Get history of a specific dosen (requires query param `dosen_id` and approved permission)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: dosen_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Dosen ID (required for mahasiswa, ignored for dosen)
 *     responses:
 *       200:
 *         description: Location history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 dosen_id:
 *                   type: string
 *                   format: uuid
 *                 dosen_name:
 *                   type: string
 *                 history:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       day_of_week:
 *                         type: integer
 *                         description: 0=Sunday, 1=Monday, ..., 6=Saturday
 *                       day_name:
 *                         type: string
 *                       logs:
 *                         type: array
 *                         description: All location logs for this day (newest first)
 *                         items:
 *                           type: object
 *                           properties:
 *                             location_name:
 *                               type: string
 *                             latitude:
 *                               type: number
 *                             longitude:
 *                               type: number
 *                             logged_at:
 *                               type: string
 *                               format: date-time
 *       400:
 *         description: Missing dosen_id for mahasiswa
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: No permission to view this dosen's history
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/tracking/history', verifyToken, trackingController.getLocationHistory);

module.exports = router;
