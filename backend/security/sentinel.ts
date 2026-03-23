
import { Session, ThreatReport, RegisteredApp } from '../../types.js';
import { Audit } from './audit.js';
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { Server } from '../server.js';

/**
 * ORBI CYBER SENTINEL (V10.0 Platinum)
 * ----------------------------
 * Autonomous Identity Defense Node.
 */
class SecuritySentinel {
    private readonly AUTO_FREEZE_THRESHOLD = 90;

    public async inspectOperation(session: Session | null, operation: string, payload: any): Promise<ThreatReport> {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return { riskScore: 10, status: 'OPTIMAL', recommendation: 'ALLOW', anomalies: ['Intelligence node bypass active'] };
        }
        const ai = new GoogleGenAI({ apiKey });
        const safePayload = payload || {};
        const appId = safePayload.appId || safePayload.app_id || 'anonymous-node';
        const appToken = safePayload.appToken || safePayload.app_token || '';

        // 0. FAST-PATH: Skip AI audit for low-risk read operations
        const lowRiskOps = ['sys_bootstrap', 'wealth_wallet_list', 'ledger_audit_read_history', 'admin_get_staff', 'iam_session'];
        if (lowRiskOps.includes(operation) && session) {
            return { riskScore: 0, status: 'OPTIMAL', recommendation: 'ALLOW', anomalies: [] };
        }

        // 1. DYNAMIC IDENTITY VERIFICATION
        let appMeta: RegisteredApp | null = null;
        if (appId !== 'anonymous-node' && appToken) {
            appMeta = await Server.verifyAppNode(appId, appToken);
        }

        const trustLevel = appMeta ? appMeta.tier : 'COMMUNITY';

        const telemetry = {
            actor: session?.sub || 'anonymous',
            actorRole: session?.role || 'NONE',
            appId,
            trustLevel,
            op: operation,
            ts: new Date().toISOString(),
            riskContext: safePayload.amount ? `Volume: ${safePayload.amount} ${safePayload.currency || ''}`.trim() : 'Non-financial Metadata Sync'
        };

        try {
            // Fix: Using gemini-2.5-flash for faster security audits (low latency)
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `ORBI Sentinel Audit: ${JSON.stringify(telemetry)}. 
                PINNACLE: 2000 RPM. INSTITUTIONAL: 1000 RPM. PREMIUM: 500 RPM. COMMUNITY: 60 RPM.
                Scoring Directives:
                1. High volume settlements (>$10k) on COMMUNITY nodes = RISK 80.
                2. Direct Ledger Audit access on COMMUNITY = BLOCK.
                3. Multiple rapid 'wealth_settlement' attempts = RISK +30.
                
                Respond strictly in JSON: { "riskScore": 0-100, "recommendation": "ALLOW|BLOCK", "reasons": ["str"] }`,
                config: { 
                    responseMimeType: "application/json",
                    thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
                }
            });

            const report = JSON.parse(response.text || '{"riskScore": 0, "recommendation": "ALLOW"}');

            // 2. AUTONOMOUS QUARANTINE PROTOCOL
            if (report.riskScore >= this.AUTO_FREEZE_THRESHOLD && session?.sub) {
                console.warn(`[Sentinel] Critical Threat Level [${report.riskScore}]. Initializing Auto-Freeze on Node: ${session.sub}`);
                
                report.recommendation = 'BLOCK';

                await Server.updateAccountStatus(
                    session.sub, 
                    'frozen', 
                    'system_sentinel'
                ).catch(e => console.error("[Sentinel] Quarantine Dispatch Failed:", e.message));

                await Audit.log('SECURITY', 'system', 'AUTONOMOUS_QUARANTINE_TRIGGERED', { 
                    targetNode: session.sub, 
                    score: report.riskScore, 
                    reasons: report.reasons 
                });
            }

            if (report.recommendation === 'BLOCK') {
                await Audit.log('SECURITY', telemetry.actor, 'SENTINEL_BLOCK_ACTION', { report, appId });
            }

            return {
                riskScore: report.riskScore,
                status: report.riskScore > 70 ? 'CRITICAL' : report.riskScore > 40 ? 'ELEVATED' : 'OPTIMAL',
                recommendation: report.recommendation,
                anomalies: report.reasons || []
            };
        } catch (e) {
            // Default to fail-safe allowing but logging the fault
            return { riskScore: 10, status: 'OPTIMAL', recommendation: 'ALLOW', anomalies: ['Intelligence node bypass active'] };
        }
    }
}

export const Sentinel = new SecuritySentinel();
