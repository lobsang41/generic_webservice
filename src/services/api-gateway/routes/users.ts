import { Router, Request, Response } from 'express';
import { authenticate } from '@middleware/auth';
import { asyncHandler, NotFoundError, ValidationError } from '@middleware/errorHandler';
import { requireScope, requireAnyScope } from '@middleware/scopeValidator';
import { SCOPES, validateScopes } from '@auth/scopes';
import mysqlDB from '@database/mysql';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Create user (admin only)
router.post('/', authenticate, requireScope(SCOPES.USERS_WRITE), asyncHandler(async (req: Request, res: Response) => {
    const { email, password, name, role = 'user', scopes } = req.body;

    // Validations
    if (!email || !password) {
        throw new ValidationError('Email and password are required');
    }

    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        throw new ValidationError('Invalid email format');
    }

    if (password.length < 6) {
        throw new ValidationError('Password must be at least 6 characters');
    }

    if (role && !['admin', 'user'].includes(role)) {
        throw new ValidationError('Role must be either "admin" or "user"');
    }

    // Validate scopes if provided
    let permissions = null;
    if (scopes && Array.isArray(scopes) && scopes.length > 0) {
        const validation = validateScopes(scopes);
        if (!validation.valid) {
            throw new ValidationError(`Invalid scopes: ${validation.invalid.join(', ')}`);
        }
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

    res.status(201).json({
        success: true,
        data: {
            user: result[0],
        },
        message: 'User created successfully',
    });
}));

// Get all users (admin only)
router.get('/', authenticate, requireScope(SCOPES.USERS_READ), asyncHandler(async (req: Request, res: Response) => {
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
router.get('/:id', authenticate, asyncHandler(async (req: Request, res: Response) => {
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
router.patch('/:id', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, scopes } = req.body;

    // Users can only update their own data unless they're admin
    if (req.user!.userId !== id && req.user!.role !== 'admin') {
        throw new ValidationError('Not authorized to update this user');
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (name) {
        updates.push('name = ?');
        values.push(name);
    }

    // Only admins can update scopes
    if (scopes && req.user!.role === 'admin') {
        if (!Array.isArray(scopes)) {
            throw new ValidationError('Scopes must be an array');
        }

        const validation = validateScopes(scopes);
        if (!validation.valid) {
            throw new ValidationError(`Invalid scopes: ${validation.invalid.join(', ')}`);
        }

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

    res.json({
        success: true,
        data: {
            user: result[0],
        },
    });
}));

// Delete user (admin only)
router.delete('/:id', authenticate, requireAnyScope([SCOPES.USERS_DELETE, SCOPES.USERS_ADMIN]), asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const result = await mysqlDB.query(
        'DELETE FROM users WHERE id = ?',
        [id],
    );

    if ((result as any).affectedRows === 0) {
        throw new NotFoundError('User not found');
    }

    res.json({
        success: true,
        message: 'User deleted successfully',
    });
}));

export default router;
