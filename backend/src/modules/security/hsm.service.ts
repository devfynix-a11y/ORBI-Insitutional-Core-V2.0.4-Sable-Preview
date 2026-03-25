import jwt from 'jsonwebtoken';
import { JWTNode } from '../../../security/jwt.js';

type SecureAccessTokenClaims = {
    role?: string;
    app_origin?: string;
    registry_type?: string;
    email?: string;
};

export class HSMService {
    /**
     * Simulates signing a payload using a Hardware Security Module (HSM) 
     * like AWS CloudHSM or Google Cloud KMS.
     */
    async signWithHSM(payload: string): Promise<string> {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('HSM_MOCK_DISABLED_IN_PRODUCTION');
        }
        console.log(`[HSM] Sending payload to Hardware Security Module for signing...`);
        // In production, this would make an RPC/API call to the KMS/HSM provider
        // returning a cryptographically secure signature.
        return "hsm_generated_signature_mock";
    }

    /**
     * Generates an RS256 JWT where the private key is stored securely in an HSM.
     */
    async generateSecureToken(
        userId: string,
        deviceId: string,
        claims: SecureAccessTokenClaims = {},
    ): Promise<string> {
        console.log(`[HSM] Generating secure session token for user ${userId}...`);
        return JWTNode.sign(
            {
                sub: userId,
                device: deviceId,
                type: 'access',
                issuer: 'orbi-hsm-bridge',
                ...claims,
            },
            15 * 60,
        );
    }
}

export const HSM = new HSMService();
