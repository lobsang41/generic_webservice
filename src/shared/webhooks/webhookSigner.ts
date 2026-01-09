import crypto from 'crypto';

/**
 * Webhook Signature Service
 * Maneja la firma HMAC-SHA256 de webhooks para seguridad
 */

export interface WebhookSignature {
    timestamp: number;
    signature: string;
}

/**
 * Genera una firma HMAC-SHA256 para un payload de webhook
 */
export function signWebhookPayload(
    payload: object,
    secret: string,
    timestamp?: number
): WebhookSignature {
    const ts = timestamp || Date.now();
    const payloadString = JSON.stringify(payload);
    
    // Formato: timestamp.payload
    const signedPayload = `${ts}.${payloadString}`;
    
    // Generar HMAC-SHA256
    const signature = crypto
        .createHmac('sha256', secret)
        .update(signedPayload)
        .digest('hex');
    
    return {
        timestamp: ts,
        signature,
    };
}

/**
 * Verifica la firma de un webhook
 */
export function verifyWebhookSignature(
    payload: object,
    signature: string,
    timestamp: number,
    secret: string,
    toleranceMs: number = 300000 // 5 minutos por defecto
): boolean {
    // Verificar que el timestamp no sea muy antiguo
    const now = Date.now();
    if (Math.abs(now - timestamp) > toleranceMs) {
        return false;
    }
    
    // Regenerar la firma
    const expectedSignature = signWebhookPayload(payload, secret, timestamp);
    
    // Comparación segura contra timing attacks
    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature.signature)
    );
}

/**
 * Genera un secret aleatorio para webhooks
 */
export function generateWebhookSecret(): string {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Construye los headers de firma para enviar con el webhook
 */
export function buildSignatureHeaders(
    payload: object,
    secret: string
): Record<string, string> {
    const { timestamp, signature } = signWebhookPayload(payload, secret);
    
    return {
        'X-Webhook-Timestamp': timestamp.toString(),
        'X-Webhook-Signature': signature,
        'X-Webhook-Signature-Version': 'v1',
    };
}

/**
 * Extrae y valida headers de firma de una request
 */
export function extractAndVerifySignature(
    headers: Record<string, string | string[] | undefined>,
    payload: object,
    secret: string
): { valid: boolean; error?: string } {
    const timestamp = headers['x-webhook-timestamp'];
    const signature = headers['x-webhook-signature'];
    
    if (!timestamp || Array.isArray(timestamp)) {
        return { valid: false, error: 'Missing or invalid timestamp header' };
    }
    
    if (!signature || Array.isArray(signature)) {
        return { valid: false, error: 'Missing or invalid signature header' };
    }
    
    const ts = parseInt(timestamp, 10);
    if (isNaN(ts)) {
        return { valid: false, error: 'Invalid timestamp format' };
    }
    
    const valid = verifyWebhookSignature(payload, signature, ts, secret);
    
    return {
        valid,
        error: valid ? undefined : 'Invalid signature',
    };
}
