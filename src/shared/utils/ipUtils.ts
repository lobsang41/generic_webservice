import ipaddr from 'ipaddr.js';

/**
 * IP Address Utilities for Whitelisting
 * Supports IPv4, IPv6, and CIDR ranges
 */

/**
 * Validate if a string is a valid IP address (IPv4 or IPv6)
 */
export function isValidIP(ip: string): boolean {
    try {
        ipaddr.process(ip);
        return true;
    } catch {
        return false;
    }
}

/**
 * Validate if a string is a valid CIDR range
 * Examples: "192.168.1.0/24", "2001:db8::/32"
 */
export function isValidCIDR(cidr: string): boolean {
    try {
        const parts = cidr.split('/');
        if (parts.length !== 2) {
            return false;
        }

        const [ip, prefixStr] = parts;
        const prefix = parseInt(prefixStr, 10);

        // Validate IP part
        const addr = ipaddr.process(ip);

        // Validate prefix length
        if (addr.kind() === 'ipv4') {
            return prefix >= 0 && prefix <= 32;
        } else {
            return prefix >= 0 && prefix <= 128;
        }
    } catch {
        return false;
    }
}

/**
 * Check if an IP address is within a CIDR range
 * @param ip - IP address to check
 * @param cidr - CIDR range (e.g., "192.168.1.0/24")
 * @returns true if IP is in range, false otherwise
 */
export function ipInRange(ip: string, cidr: string): boolean {
    try {
        const addr = ipaddr.process(ip);
        const [rangeIp, prefixStr] = cidr.split('/');
        const rangeAddr = ipaddr.process(rangeIp);
        const prefix = parseInt(prefixStr, 10);

        // Both must be same type (IPv4 or IPv6)
        if (addr.kind() !== rangeAddr.kind()) {
            return false;
        }

        return addr.match(rangeAddr, prefix);
    } catch {
        return false;
    }
}

/**
 * Normalize IP address to standard format
 * Removes IPv6 zone identifiers and normalizes representation
 */
export function normalizeIP(ip: string): string {
    try {
        const addr = ipaddr.process(ip);
        return addr.toString();
    } catch {
        return ip;
    }
}

/**
 * Extract client IP from Express request
 * Handles proxies and load balancers (x-forwarded-for header)
 */
export function getClientIP(req: any): string {
    // Check x-forwarded-for header (from proxies/load balancers)
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        // x-forwarded-for can be a comma-separated list, take the first one
        const ips = forwarded.split(',').map((ip: string) => ip.trim());
        return normalizeIP(ips[0]);
    }

    // Check x-real-ip header (some proxies use this)
    const realIp = req.headers['x-real-ip'];
    if (realIp) {
        return normalizeIP(realIp);
    }

    // Fall back to req.ip (Express default)
    return normalizeIP(req.ip || req.connection?.remoteAddress || '');
}

/**
 * Check if IP is localhost/loopback
 * Useful for bypassing whitelist in development
 */
export function isLocalhost(ip: string): boolean {
    try {
        const addr = ipaddr.process(ip);
        
        if (addr.kind() === 'ipv4') {
            // 127.0.0.0/8
            return addr.match(ipaddr.IPv4.parse('127.0.0.1'), 8);
        } else {
            // ::1
            return addr.toNormalizedString() === '::1';
        }
    } catch {
        return false;
    }
}

/**
 * Check if IP is in private range (RFC 1918)
 * 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
 */
export function isPrivateIP(ip: string): boolean {
    try {
        const addr = ipaddr.process(ip);
        
        if (addr.kind() === 'ipv4') {
            return (
                addr.match(ipaddr.IPv4.parse('10.0.0.0'), 8) ||
                addr.match(ipaddr.IPv4.parse('172.16.0.0'), 12) ||
                addr.match(ipaddr.IPv4.parse('192.168.0.0'), 16)
            );
        }
        
        return false;
    } catch {
        return false;
    }
}
