import { getAdminSupabase } from '../../services/supabaseClient.js';
import { UUID } from '../../services/utils.js';
import { Transaction } from '../../types.js';
import { FXEngine } from '../ledger/FXEngine.js';

export interface AMLAlert {
    id: string;
    transaction_id: string;
    user_id: string;
    risk_score: number;
    reason: string;
    status: 'PENDING' | 'INVESTIGATING' | 'CLEARED' | 'BLOCKED';
    created_at: string;
}

export class RiskComplianceEngine {
    
    /**
     * Transaction Monitoring for AML (Anti-Money Laundering)
     * Checks a transaction against rules and flags it if suspicious.
     */
    static async monitorTransaction(tx: Transaction): Promise<AMLAlert | null> {
        let riskScore = 0;
        let reasons: string[] = [];
        const sb = getAdminSupabase();

        if (!sb) {
            console.error("[AML] Critical Fault: Database offline. Cannot monitor transaction.");
            return null;
        }

        // Normalize amount to USD for consistent AML rule checking
        const txCurrency = (tx.currency || '').toUpperCase();
        if (!txCurrency) {
            throw new Error('CURRENCY_REQUIRED: Transaction currency is required for AML checks.');
        }
        const amountInUSD = await FXEngine.convertToUSD(tx.amount, txCurrency);

        // Rule 1: High value transaction (Normalized to USD)
        if (amountInUSD > 10000) {
            riskScore += 50;
            reasons.push(`High value transaction exceeding $10,000 USD (Original: ${tx.amount} ${txCurrency}, Eqv: $${amountInUSD.toFixed(2)} USD)`);
        }

        // Rule 2: Structuring / Smurfing (Transactions just below reporting threshold)
        if (amountInUSD >= 9000 && amountInUSD <= 10000) {
            riskScore += 40;
            reasons.push(`Potential structuring: Amount $${amountInUSD.toFixed(2)} USD is just below the $10,000 reporting threshold`);
        }

        // Rule 3: Rapid successive transactions (Velocity Check)
        if (tx.user_id) {
            try {
                // Check transactions in the last 24 hours
                const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
                const { data: recentTxs, error } = await sb
                    .from('transactions')
                    .select('id, amount, currency')
                    .eq('user_id', tx.user_id)
                    .gte('created_at', oneDayAgo);

                if (!error && recentTxs) {
                    // Check transaction count
                    if (recentTxs.length >= 5) {
                        riskScore += 30;
                        reasons.push(`High transaction velocity: ${recentTxs.length} transactions in the last 24 hours`);
                    }
                    
                    // Check cumulative volume in USD
                    let volumeUSD = 0;
                    for (const rTx of recentTxs) {
                        const relatedCurrency = (rTx.currency || '').toUpperCase();
                        if (!relatedCurrency) {
                            throw new Error('CURRENCY_REQUIRED: Historical transaction currency is required for AML checks.');
                        }
                        volumeUSD += await FXEngine.convertToUSD(Number(rTx.amount || 0), relatedCurrency);
                    }
                    
                    if (volumeUSD + amountInUSD > 15000) {
                        riskScore += 40;
                        reasons.push(`High cumulative volume: Exceeded $15,000 USD in the last 24 hours (Total Eqv: $${(volumeUSD + amountInUSD).toFixed(2)} USD)`);
                    }
                }
            } catch (e) {
                console.error("[AML] Velocity check failed:", e);
            }
        }

        // Rule 4: Cross-border or high-risk jurisdictions
        const highRiskCountries = ['PRK', 'IRN', 'SYR', 'CUB', 'MMR', 'AFG', 'SSD'];
        const txCountry = tx.metadata?.country || tx.metadata?.destination_country;
        if (txCountry && highRiskCountries.includes(String(txCountry).toUpperCase())) {
            riskScore += 80;
            reasons.push(`High-risk jurisdiction involved: ${txCountry}`);
        }

        // Rule 5: Unusual time of transaction (e.g., flagged by client metadata)
        if (tx.metadata?.is_unusual_time) {
            riskScore += 20;
            reasons.push("Transaction flagged as occurring at an unusual time");
        }

        // Generate alert if risk score is significant (e.g., >= 50)
        if (riskScore >= 50) {
            const alert: AMLAlert = {
                id: UUID.generate(),
                transaction_id: String(tx.id),
                user_id: tx.user_id || 'UNKNOWN',
                risk_score: riskScore,
                reason: reasons.join(' | '),
                status: 'PENDING',
                created_at: new Date().toISOString()
            };

            await this.logAMLAlert(alert);
            return alert;
        }

        return null;
    }

    /**
     * Log an AML alert to the database
     */
    static async logAMLAlert(alert: AMLAlert) {
        const sb = getAdminSupabase();
        if (sb) {
            await sb.from('aml_alerts').insert(alert);
        } else {
            console.error("[AML] Critical Fault: Database offline. Cannot log alert.", alert);
        }
    }

    /**
     * Get pending AML alerts
     */
    static async getPendingAlerts(): Promise<AMLAlert[]> {
        const sb = getAdminSupabase();
        if (sb) {
            const { data } = await sb.from('aml_alerts').select('*').eq('status', 'PENDING');
            return data || [];
        }
        return [];
    }

    /**
     * Update AML alert status
     */
    static async updateAlertStatus(alertId: string, status: 'INVESTIGATING' | 'CLEARED' | 'BLOCKED') {
        const sb = getAdminSupabase();
        if (sb) {
            await sb.from('aml_alerts').update({ status }).eq('id', alertId);
        }
    }

    /**
     * Generate Regulatory Report (e.g., Suspicious Activity Report - SAR)
     */
    static async generateRegulatoryReport(startDate: string, endDate: string) {
        const sb = getAdminSupabase();
        let alerts: AMLAlert[] = [];
        
        if (sb) {
            const { data } = await sb.from('aml_alerts')
                .select('*')
                .gte('created_at', startDate)
                .lte('created_at', endDate);
            alerts = data || [];
        }

        return {
            report_id: UUID.generate(),
            period: { start: startDate, end: endDate },
            total_alerts: alerts.length,
            high_risk_alerts: alerts.filter(a => a.risk_score >= 50).length,
            blocked_transactions: alerts.filter(a => a.status === 'BLOCKED').length,
            generated_at: new Date().toISOString()
        };
    }
}
