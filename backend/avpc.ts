
import { UserRole, Permission, Session } from '../types.js';
import { RedisManager } from './enterprise/infrastructure/RedisManager.js';

// --- 1. POLICY SCHEMA DEFINITIONS ---

export type PolicyDirection = 'INGRESS' | 'EGRESS';
export type PolicyDecision = 'ALLOW' | 'DENY' | 'CHALLENGE';

export interface IdentityRule {
    roles: UserRole[];
    permissions: Permission[];
    client_allowlist?: string[];
    require_mfa?: boolean;
}

export interface NetworkRule {
    ip_allowlist?: string[]; 
    geo_block?: string[];
    rate_limit?: {
        requests: number;
        per_seconds: number;
    };
}

export interface PayloadRule {
    schema?: string;
    max_amount?: number;
    required_fields?: string[];
    banned_fields?: string[];
}

export interface ScopeRule {
    row_filter?: string; 
    field_masking?: string[];
}

export interface AVPCPolicy {
    policy_id: string;
    priority: number; // Higher precedence for lower numbers (0-100)
    direction: PolicyDirection;
    service: string;
    endpoint?: string; 
    table?: string;    
    operation?: 'READ' | 'WRITE' | 'DELETE' | 'UPDATE';
    identity: IdentityRule;
    network?: NetworkRule;
    payload?: PayloadRule;
    scope?: ScopeRule; 
    decision: PolicyDecision;
}

// --- 2. ACTIVE POLICIES ---

export const POLICIES: Record<string, AVPCPolicy> = {
    'wallet_debit': {
        policy_id: 'wallet_debit_v1',
        priority: 100,
        direction: 'INGRESS',
        service: 'wallet-service',
        endpoint: '/wallet/debit',
        operation: 'WRITE',
        identity: {
            roles: ['USER', 'CONSUMER', 'MERCHANT', 'AGENT', 'SYSTEM', 'SUPER_ADMIN'],
            permissions: ['wallet.debit']
        },
        payload: {
            max_amount: 5000000,
            required_fields: ['wallet_id', 'amount']
        },
        network: {
            rate_limit: { requests: 10, per_seconds: 60 }
        },
        decision: 'ALLOW'
    },

    'transaction_create': {
        policy_id: 'tx_create_v1',
        priority: 100,
        direction: 'INGRESS',
        service: 'transaction-service',
        endpoint: '/transaction/create',
        operation: 'WRITE',
        identity: {
            roles: ['USER', 'CONSUMER', 'MERCHANT', 'AGENT', 'SYSTEM', 'ADMIN', 'SUPER_ADMIN'],
            permissions: ['transaction.create']
        },
        payload: {
            max_amount: 10000000,
            required_fields: ['amount', 'type']
        },
        decision: 'ALLOW'
    },

    'ledger_read_user': {
        policy_id: 'ledger_read_user_v1',
        priority: 100,
        direction: 'EGRESS',
        service: 'ledger-service',
        table: 'transactions',
        operation: 'READ',
        identity: {
            roles: ['USER', 'CONSUMER', 'MERCHANT', 'AGENT'],
            permissions: ['transaction.view']
        },
        scope: {
            row_filter: 'user_id = $session.sub',
            field_masking: ['internal_ref', 'compliance_meta']
        },
        decision: 'ALLOW'
    },

    'ledger_read_admin': {
        policy_id: 'ledger_read_admin_v1',
        priority: 10,
        direction: 'EGRESS',
        service: 'ledger-service',
        table: 'transactions',
        operation: 'READ',
        identity: {
            roles: ['ADMIN', 'SUPER_ADMIN'],
            permissions: ['admin.audit.read']
        },
        scope: {
            row_filter: 'ALL',
            field_masking: []
        },
        decision: 'ALLOW'
    }
};

// --- 3. AVPC ENGINE ---

class AVPCEngine {
    public async enforce(targetPolicyId: string, session: Session | null, context: { ip?: string, payload?: any }): Promise<boolean> {
        const targetPolicy = POLICIES[targetPolicyId];
        if (!targetPolicy) {
            throw new Error(`AVPC: Security Policy Violation (Unknown Policy: ${targetPolicyId})`);
        }

        // Collect target and all higher-priority interceptors
        const applicablePolicies = Object.values(POLICIES)
            .filter(p => 
                p.service === targetPolicy.service && 
                p.direction === targetPolicy.direction &&
                (p.priority < targetPolicy.priority || p.policy_id === targetPolicyId)
            )
            .sort((a, b) => a.priority - b.priority);

        if (!session || !session.user) {
            throw new Error("AVPC: Unauthorized - Identity Verification Failed");
        }

        // Sequential evaluation chain
        for (const policy of applicablePolicies) {
            if (policy.decision === 'DENY') throw new Error(`AVPC: Request DENIED by policy ${policy.policy_id}`);
            if (policy.decision === 'CHALLENGE') throw new Error("AVPC: Step-up authentication required (MFA)");

            if (policy.identity.roles.length > 0 && !policy.identity.roles.includes(session.role)) {
                throw new Error(`AVPC: Role '${session.role}' denied by policy ${policy.policy_id}`);
            }

            const missingPerms = policy.identity.permissions.filter(p => !session.permissions.includes(p));
            if (missingPerms.length > 0) {
                throw new Error(`AVPC: Permission denied. Missing: ${missingPerms.join(', ')}`);
            }

            if (policy.network?.rate_limit) {
                const clientKey = `${session.sub}:${policy.policy_id}`;
                const isAllowed = await this.checkRateLimit(clientKey, policy.network.rate_limit);
                if (!isAllowed) {
                    throw new Error("AVPC: Rate limit exceeded. Traffic throttled.");
                }
            }

            if (policy.payload && context.payload) {
                if (policy.payload.required_fields) {
                    for (const field of policy.payload.required_fields) {
                        if (context.payload[field] === undefined) throw new Error(`AVPC: Malformed Payload. Missing: ${field}`);
                    }
                }
                if (policy.payload.max_amount && Math.abs(context.payload.amount || 0) > policy.payload.max_amount) {
                    throw new Error(`AVPC: Amount exceeds policy limit of ${policy.payload.max_amount}`);
                }
            }
        }

        return true;
    }

    private async checkRateLimit(key: string, limit: { requests: number, per_seconds: number }): Promise<boolean> {
        const now = Date.now();
        const window = limit.per_seconds * 1000;
        const cacheKey = `avpc:rate_limit:${key}`;
        
        let timestamps: number[] = await RedisManager.get(cacheKey) || [];
        
        timestamps = timestamps.filter(t => now - t < window);
        if (timestamps.length >= limit.requests) return false;
        
        timestamps.push(now);
        await RedisManager.set(cacheKey, timestamps, limit.per_seconds);
        return true;
    }
}

export const AVPC = new AVPCEngine();
