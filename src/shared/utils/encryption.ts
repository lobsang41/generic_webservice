import crypto from 'crypto';
import { config } from '@config/index';

export class EncryptionService {
    private algorithm: string;
    private key: Buffer;

    constructor() {
        this.algorithm = config.encryption.algorithm;
        // Ensure key is 32 bytes for aes-256
        this.key = Buffer.from(config.encryption.key.padEnd(32, '0').slice(0, 32));
    }

    encrypt(text: string): string {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const authTag = (cipher as crypto.CipherGCM).getAuthTag();

        // Return IV + AuthTag + Encrypted data
        return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    }

    decrypt(encryptedData: string): string {
        const parts = encryptedData.split(':');
        if (parts.length !== 3) {
            throw new Error('Invalid encrypted data format');
        }

        const [ivHex, authTagHex, encrypted] = parts;
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');

        const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
        (decipher as crypto.DecipherGCM).setAuthTag(authTag);

        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    }

    hash(text: string): string {
        return crypto.createHash('sha256').update(text).digest('hex');
    }

    compareHash(text: string, hash: string): boolean {
        return this.hash(text) === hash;
    }

    generateRandomToken(length: number = 32): string {
        return crypto.randomBytes(length).toString('hex');
    }

    generateSecureToken(): string {
        return crypto.randomBytes(32).toString('base64url');
    }
}

export const encryptionService = new EncryptionService();
export default encryptionService;
