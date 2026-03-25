import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
    throw new Error("JWT_SECRET is required in production");
}

const FINAL_SECRET = JWT_SECRET || "secure-bank-secret-key-dev";

export class SessionService {
    createSession(
        userId: string,
        deviceId?: string,
        claims: {
            role?: string;
            app_origin?: string;
            registry_type?: string;
            email?: string;
        } = {},
    ) {
        return jwt.sign(
            {
                userId,
                deviceId,
                type: 'access',
                ...claims,
            },
            FINAL_SECRET,
            { expiresIn: "15m" }
        );
    }

    createRefreshToken(userId: string, deviceId?: string) {
        return jwt.sign(
            { userId, deviceId, type: 'refresh' },
            FINAL_SECRET,
            { expiresIn: "30d" }
        );
    }

    verifyToken(token: string) {
        try {
            return jwt.verify(token, FINAL_SECRET);
        } catch (e) {
            return null;
        }
    }
}

export const Sessions = new SessionService();
