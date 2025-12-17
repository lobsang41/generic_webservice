import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '@middleware/auth';
import { asyncHandler, NotFoundError, ValidationError } from '@middleware/errorHandler';
import postgresDB from '@database/postgres';

const router = Router();

// Get all users (admin only)
router.get('/', authenticate, authorize('admin'), asyncHandler(async (req: Request, res: Response) => {
    const { page = 1, limit = 10 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const result = await postgresDB.query(
        `SELECT id, email, name, role, created_at
     FROM users
     ORDER BY created_at DESC
     LIMIT $1 OFFSET $2`,
        [limit, offset],
    );

    const countResult = await postgresDB.query('SELECT COUNT(*) FROM users');
    const total = parseInt(countResult.rows[0].count, 10);

    res.json({
        success: true,
        data: {
            users: result.rows,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit)),
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

    const result = await postgresDB.query(
        'SELECT id, email, name, role, created_at FROM users WHERE id = $1',
        [id],
    );

    if (result.rows.length === 0) {
        throw new NotFoundError('User not found');
    }

    res.json({
        success: true,
        data: {
            user: result.rows[0],
        },
    });
}));

// Update user
router.patch('/:id', authenticate, asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name } = req.body;

    // Users can only update their own data unless they're admin
    if (req.user!.userId !== id && req.user!.role !== 'admin') {
        throw new ValidationError('Not authorized to update this user');
    }

    if (!name) {
        throw new ValidationError('Name is required');
    }

    const result = await postgresDB.query(
        'UPDATE users SET name = $1 WHERE id = $2 RETURNING id, email, name, role, created_at',
        [name, id],
    );

    if (result.rows.length === 0) {
        throw new NotFoundError('User not found');
    }

    res.json({
        success: true,
        data: {
            user: result.rows[0],
        },
    });
}));

// Delete user (admin only)
router.delete('/:id', authenticate, authorize('admin'), asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const result = await postgresDB.query(
        'DELETE FROM users WHERE id = $1 RETURNING id',
        [id],
    );

    if (result.rows.length === 0) {
        throw new NotFoundError('User not found');
    }

    res.json({
        success: true,
        message: 'User deleted successfully',
    });
}));

export default router;
