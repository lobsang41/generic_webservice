import { z } from 'zod';
import { uuidSchema } from './common.schemas';
import { isValidIP, isValidCIDR } from '@utils/ipUtils';

/**
 * IP Whitelist validation schemas
 */

// Custom validator for IP address
const ipAddressValidator = z.string().refine(
    (val) => isValidIP(val),
    {
        message: 'Invalid IP address format',
    }
);

// Custom validator for CIDR range
const cidrRangeValidator = z.string().refine(
    (val) => isValidCIDR(val),
    {
        message: 'Invalid CIDR range format (e.g., 192.168.1.0/24)',
    }
);

// Add IP to whitelist schema
export const addIPWhitelistSchema = z.object({
    ip_address: ipAddressValidator.optional(),
    cidr_range: cidrRangeValidator.optional(),
    description: z.string().max(255).optional(),
}).refine(
    (data) => data.ip_address || data.cidr_range,
    {
        message: 'Either ip_address or cidr_range must be provided',
        path: ['ip_address'],
    }
).refine(
    (data) => !(data.ip_address && data.cidr_range),
    {
        message: 'Cannot provide both ip_address and cidr_range',
        path: ['cidr_range'],
    }
);

// Client ID params schema
export const ipWhitelistClientParamsSchema = z.object({
    clientId: uuidSchema,
});

// IP whitelist entry ID params schema
export const ipWhitelistEntryParamsSchema = z.object({
    clientId: uuidSchema,
    id: uuidSchema,
});

// Type exports
export type AddIPWhitelistInput = z.infer<typeof addIPWhitelistSchema>;
export type IPWhitelistClientParams = z.infer<typeof ipWhitelistClientParamsSchema>;
export type IPWhitelistEntryParams = z.infer<typeof ipWhitelistEntryParamsSchema>;
