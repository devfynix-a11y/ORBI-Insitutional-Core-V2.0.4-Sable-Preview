
import { UserRole, Permission, Session } from '../../types.js';

export type PolicyDirection = 'INGRESS' | 'EGRESS';
export type PolicyDecision = 'ALLOW' | 'DENY' | 'CHALLENGE' | 'BLOCK';

export interface IdentityRule {
    roles: UserRole[];
    permissions: Permission[];
    client_allowlist?: string[];
    require_mfa?: boolean;
    allowed_scopes?: string[]; // E.g. 'read:transactions', 'write:settlements'
}

export interface NetworkRule {
    ip_allowlist?: string[]; 
    geo_block?: string[];
    rate_limit?: { requests: number; per_seconds: number; };
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
    priority: number; 
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

export const POLICIES: Record<string, AVPCPolicy> = {
    'global_freeze': {
        policy_id: 'sys_killswitch_global_v1',
        priority: 0, direction: 'INGRESS', service: 'core-service',
        operation: 'WRITE', identity: { roles: [], permissions: [] }, decision: 'ALLOW' 
    },
    'wallet_debit': {
        policy_id: 'wallet_debit_v1',
        priority: 100,
        direction: 'INGRESS',
        service: 'wealth-service',
        identity: {
            roles: ['USER', 'CONSUMER', 'MERCHANT', 'AGENT', 'SYSTEM', 'SUPER_ADMIN'],
            permissions: ['wallet.debit']
        },
        payload: {
            max_amount: 5000000,
            required_fields: ['wallet_id', 'amount']
        },
        decision: 'ALLOW'
    },
    'external_api_access': {
        policy_id: 'ext_api_v1',
        priority: 20, direction: 'INGRESS', service: 'gateway',
        identity: { 
            roles: ['USER', 'CONSUMER', 'MERCHANT', 'AGENT', 'SYSTEM'], 
            permissions: ['user.read'],
            allowed_scopes: ['read:profile', 'read:accounts']
        },
        decision: 'ALLOW'
    },
    'high_value_settlement': {
        policy_id: 'fin_whale_alert_v1',
        priority: 80, direction: 'INGRESS', service: 'wealth-service', operation: 'WRITE',
        identity: { roles: ['USER', 'CONSUMER', 'MERCHANT', 'AGENT'], permissions: ['wallet.debit'] },
        payload: { max_amount: 50000 },
        decision: 'CHALLENGE' 
    }
};

class AVPCEngine {
    private rateLimitStore: Map<string, number[]> = new Map();
    private dynamicOverrides: Map<string, PolicyDecision> = new Map();

    public setPolicyOverride(policyId: string, decision: PolicyDecision) {
        this.dynamicOverrides.set(policyId, decision);
    }

    public enforce(targetPolicyId: string, session: Session | null, context: { ip?: string, payload?: any }): boolean {
        const targetPolicy = POLICIES[targetPolicyId];
        if (!targetPolicy) throw new Error(`AVPC_FAULT: Security reference missing [${targetPolicyId}]`);

        const override = this.dynamicOverrides.get(targetPolicyId);
        if (override === 'BLOCK') throw new Error("AVPC_BLOCK: Cyber Sentinel has locked this operation.");
        if (override === 'CHALLENGE') throw new Error("AVPC_MFA_REQUIRED: Dynamic challenge triggered.");

        // Check permissions if session exists
        if (session) {
            const missingPerms = targetPolicy.identity.permissions.filter(p => !session.permissions.includes(p));
            if (missingPerms.length > 0) {
                throw new Error(`AVPC_DENIED: Missing required permissions: ${missingPerms.join(', ')}`);
            }
        }

        return true;
    }
}

export const AVPC = new AVPCEngine();
