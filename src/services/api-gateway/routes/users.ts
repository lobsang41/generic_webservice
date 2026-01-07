import { Router, Request, Response } from 'express';
import { authenticate } from '@middleware/auth';
import { asyncHandler, NotFoundError, ValidationError } from '@middleware/errorHandler';
import { requireScope, requireAnyScope } from '@middleware/scopeValidator';
import { SCOPES } from '@auth/scopes';
import mysqlDB from '@database/mysql';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { logInsert, logUpdate, logDelete, getAuditMetadata } from '@shared/utils/auditLogger';
import { validateRequest } from '@validation/middleware/validateRequest';
import {
    createUserSchema,
    updateUserSchema,
    getUserParamsSchema,
    listUsersQuerySchema,
} from '@validation/schemas/user.schemas';

const router = Router();

// Create user (admin only)
router.post('/',
    authenticate,
    requireScope(SCOPES.USERS_WRITE),
    validateRequest({ body: createUserSchema }),
    asyncHandler(async (req: Request, res: Response) => {
        const { email, password, name, role = 'user', scopes } = req.body;

        // Validate scopes if provided and convert to permissions JSON
        let permissions = null;
        if (scopes && Array.isArray(scopes) && scopes.length > 0) {
            permissions = JSON.stringify({ scopes });
        }

    // Check if user already exists
    const existing = await mysqlDB.query(
        'SELECT id FROM users WHERE email = ?',
        [email]
    );

    if (existing.length > 0) {
        throw new ValidationError('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    // Create user
    await mysqlDB.query(
        `INSERT INTO users (id, email, password_hash, name, role, permissions, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [userId, email, hashedPassword, name || email.split('@')[0], role, permissions]
    );

    // Get created user
    const result = await mysqlDB.query(
        'SELECT id, email, name, role, permissions, created_at FROM users WHERE id = ?',
        [userId]
    );

    // Log audit
    await logInsert('users', userId, {
        email,
        name: name || email.split('@')[0],
        role,
        permissions,
        is_active: 1,
        email_verified: 0,
    }, getAuditMetadata(req));

    res.status(201).json({
        success: true,
        data: {
            user: result[0],
        },
        message: 'User created successfully',
    });
}));

// Get all users (admin only)
router.get('/',
    authenticate,
    requireScope(SCOPES.USERS_READ),
    validateRequest({ query: listUsersQuerySchema }),
    asyncHandler(async (req: Request, res: Response) => {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const result = await mysqlDB.query(
        `SELECT id, email, name, role, permissions, created_at
     FROM users
     ORDER BY created_at DESC
     LIMIT ${limit} OFFSET ${offset}`
    );

    const countResult = await mysqlDB.query('SELECT COUNT(*) as count FROM users');
    const total = parseInt((countResult[0] as any).count, 10);

    res.json({
        success: true,
        data: {
            users: result,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        },
    });
}));

// Get user by ID
router.get('/:id',
    authenticate,
    validateRequest({ params: getUserParamsSchema }),
    asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;

    // Users can only get their own data unless they're admin
    if (req.user!.userId !== id && req.user!.role !== 'admin') {
        throw new ValidationError('Not authorized to view this user');
    }

    const result = await mysqlDB.query(
        'SELECT id, email, name, role, permissions, created_at FROM users WHERE id = ?',
        [id]
    );

    if (result.length === 0) {
        throw new NotFoundError('User not found');
    }

    res.json({
        success: true,
        data: {
            user: result[0],
        },
    });
}));

// Update user
router.patch('/:id',
    authenticate,
    validateRequest({
        params: getUserParamsSchema,
        body: updateUserSchema,
    }),
    asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const { name, scopes } = req.body;

    // Users can only update their own data unless they're admin
    if (req.user!.userId !== id && req.user!.role !== 'admin') {
        throw new ValidationError('Not authorized to update this user');
    }

    // Get old values for audit
    const oldUser = await mysqlDB.query(
        'SELECT id, email, name, role, permissions FROM users WHERE id = ?',
        [id]
    );

    if (oldUser.length === 0) {
        throw new NotFoundError('User not found');
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (name) {
        updates.push('name = ?');
        values.push(name);
    }

    // Only admins can update scopes
    if (scopes && req.user!.role === 'admin') {
        updates.push('permissions = ?');
        values.push(JSON.stringify({ scopes }));
    }

    if (updates.length === 0) {
        throw new ValidationError('No fields to update');
    }

    values.push(id);

    await mysqlDB.query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
        values
    );

    const result = await mysqlDB.query(
        'SELECT id, email, name, role, permissions, created_at FROM users WHERE id = ?',
        [id]
    );

    if (result.length === 0) {
        throw new NotFoundError('User not found');
    }

    // Log audit
    await logUpdate('users', id, {
        name: (oldUser[0] as any).name,
        role: (oldUser[0] as any).role,
        permissions: (oldUser[0] as any).permissions,
    }, {
        name: (result[0] as any).name,
        role: (result[0] as any).role,
        permissions: (result[0] as any).permissions,
    }, getAuditMetadata(req));

    res.json({
        success: true,
        data: {
            user: result[0],
        },
    });
}));

// Delete user (admin only)
router.delete('/:id',
    authenticate,
    requireAnyScope([SCOPES.USERS_DELETE, SCOPES.USERS_ADMIN]),
    validateRequest({ params: getUserParamsSchema }),
    asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;

    // Get user data before deleting for audit
    const userData = await mysqlDB.query(
        'SELECT id, email, name, role, permissions FROM users WHERE id = ?',
        [id]
    );

    if (userData.length === 0) {
        throw new NotFoundError('User not found');
    }

    const result = await mysqlDB.query(
        'DELETE FROM users WHERE id = ?',
        [id],
    );

    if ((result as any).affectedRows === 0) {
        throw new NotFoundError('User not found');
    }

    // Log audit
    await logDelete('users', id, {
        email: (userData[0] as any).email,
        name: (userData[0] as any).name,
        role: (userData[0] as any).role,
        permissions: (userData[0] as any).permissions,
    }, getAuditMetadata(req));

    res.json({
        success: true,
        message: 'User deleted successfully',
    });
}));

export default router;
