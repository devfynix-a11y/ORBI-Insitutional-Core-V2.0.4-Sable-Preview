
import { RuleDefinition, TransactionLimits } from '../../types.js';
import { getSupabase } from '../../services/supabaseClient.js';
import { Storage } from '../storage.js';
import { MonitorReloader } from './MonitorReloader.js';

/**
 * ORBI DYNAMIC RULES CONFIG CLIENT (V3.0 Platinum)
 * -----------------------------------------
 * Manages institutional security parameters with high-integrity table suite.
 * Features: Granular persistence for limits and neural rules.
 */
export class RulesConfigClient {
    private static instance: RulesConfigClient;
    private configCache: any = null;
    private lastFetchTime: number = 0;
    private readonly CACHE_TTL_MS = 60000; 
    private readonly STORAGE_KEY = 'orbi_rules_config_v3';

    private constructor() {}

    public static getInstance() {
        if (!RulesConfigClient.instance) RulesConfigClient.instance = new RulesConfigClient();
        return RulesConfigClient.instance;
    }

    /**
     * FETCH DYNAMIC RULES & LIMITS
     * Multi-Table Sync: infra_tx_limits (Performance) + infra_system_matrix (Neural Rules)
     */
    public async getRuleConfig(forceRefresh = false): Promise<any> {
        const now = Date.now();
        
        if (!forceRefresh && this.configCache && (now - this.lastFetchTime < this.CACHE_TTL_MS)) {
            return this.configCache;
        }

        const sb = getSupabase();
        if (sb) {
            try {
                const [limitsRes, rulesRes, fxRes, commissionRes] = await Promise.all([
                    sb.from('infra_tx_limits').select('*').eq('id', 'MASTER_LIMITS').maybeSingle(),
                    sb.from('infra_system_matrix').select('config_data').eq('config_key', 'HEURISTIC_RULES').maybeSingle(),
                    sb.from('infra_system_matrix').select('config_data').eq('config_key', 'FX_RATES').maybeSingle(),
                    sb.from('infra_system_matrix').select('config_data').eq('config_key', 'SERVICE_COMMISSIONS').maybeSingle()
                ]);
                
                if (limitsRes.data && rulesRes.data) {
                    const merged = {
                        version: "4.0.0",
                        transaction_limits: {
                            max_per_transaction: Number(limitsRes.data.max_per_transaction),
                            max_daily_total: Number(limitsRes.data.max_daily_total),
                            max_monthly_total: Number(limitsRes.data.max_monthly_total),
                            category_limits: {
                                ...limitsRes.data.category_limits,
                                velocity_limit: limitsRes.data.category_limits?.velocity_limit || 50,
                                freeze_duration: limitsRes.data.category_limits?.freeze_duration || 604800
                            }
                        },
                        rules: rulesRes.data.config_data,
                        exchange_rates: fxRes.data?.config_data || this.getDefaultConfig().exchange_rates,
                        commission_programs: commissionRes.data?.config_data || this.getDefaultConfig().commission_programs,
                        decision_matrix: this.getDefaultConfig().decision_matrix
                    };
                    
                    this.configCache = merged;
                    this.lastFetchTime = now;
                    Storage.cacheSet(this.STORAGE_KEY, merged);
                    return merged;
                }
            } catch (e) {
                console.warn("[InfraConfig] Cloud node lag. Reverting to local cache.");
            }
        }

        const local = Storage.cacheGet(this.STORAGE_KEY);
        if (local) {
            this.configCache = local;
            return local;
        }

        const defaults = this.getDefaultConfig();
        await this.saveConfig(defaults);
        return defaults;
    }

    /**
     * INVALIDATE CACHE
     * Forces the next getRuleConfig call to fetch fresh data from the database.
     */
    public invalidateCache() {
        this.configCache = null;
        this.lastFetchTime = 0;
        Storage.removeItem(this.STORAGE_KEY);
    }

    /**
     * COMMIT CONFIGURATION ROTATION
     * Splits and persists data into dedicated infra tables for isolation.
     */
    public async saveConfig(config: any) {
        this.configCache = config;
        this.lastFetchTime = Date.now();
        Storage.cacheSet(this.STORAGE_KEY, config);

        const sb = getSupabase();
        if (sb) {
            try {
                const { data: { session } } = await sb.auth.getSession();
                const userId = session?.user?.id;

                const { limits, rules, fxRates, commissionPrograms } = this.splitConfig(config);

                await Promise.all([
                    sb.from('infra_tx_limits').upsert({
                        id: 'MASTER_LIMITS',
                        ...limits,
                        updated_at: new Date().toISOString(),
                        updated_by: userId
                    }),
                    sb.from('infra_system_matrix').upsert({
                        config_key: 'HEURISTIC_RULES',
                        config_data: rules,
                        updated_at: new Date().toISOString(),
                        updated_by: userId
                    }),
                    sb.from('infra_system_matrix').upsert({
                        config_key: 'FX_RATES',
                        config_data: fxRates,
                        updated_at: new Date().toISOString(),
                        updated_by: userId
                    }),
                    sb.from('infra_system_matrix').upsert({
                        config_key: 'SERVICE_COMMISSIONS',
                        config_data: commissionPrograms,
                        updated_at: new Date().toISOString(),
                        updated_by: userId
                    })
                ]);

                await MonitorReloader.notifyReload('INFRA_RULES_ROTATED');
            } catch (e: any) {
                console.error("[InfraConfig] Commitment Fault:", e.message);
                throw e;
            }
        }
    }

    private splitConfig(config: any) {
        return {
            limits: {
                max_per_transaction: config.transaction_limits.max_per_transaction,
                max_daily_total: config.transaction_limits.max_daily_total,
                max_monthly_total: config.transaction_limits.max_monthly_total,
                category_limits: {
                    ...config.transaction_limits.category_limits,
                    velocity_limit: config.transaction_limits.category_limits?.velocity_limit,
                    freeze_duration: config.transaction_limits.category_limits?.freeze_duration
                }
            },
            rules: config.rules,
            fxRates: config.exchange_rates,
            commissionPrograms: config.commission_programs || this.getDefaultConfig().commission_programs
        };
    }

    private getDefaultConfig() {
        return {
            version: "4.0.0",
            transaction_limits: {
                max_per_transaction: 1000000,
                max_daily_total: 5000000,
                max_monthly_total: 20000000,
                category_limits: {
                    'business': 500000,
                    'general': 50000,
                    'velocity_limit': 50,
                    'freeze_duration': 604800
                }
            },
            exchange_rates: {
                'USD': 1,
                'EUR': 0.92,
                'GBP': 0.78,
                'TZS': 2550,
                'KES': 135,
                'UGX': 3900,
                'RWF': 1280,
                'ZAR': 19,
                'NGN': 1500,
                'GHS': 13.5
            },
            commission_programs: {
                agent_referral: {
                    enabled: true,
                    rate: 0.0025,
                    fixed_amount: 0,
                    duration_days: 90
                },
                agent_cash: {
                    enabled: true,
                    deposit_rate: 0.001,
                    deposit_fixed_amount: 0,
                    withdrawal_rate: 0.0015,
                    withdrawal_fixed_amount: 0
                }
            },
            rules: {
                "VL-001": { id: "VL-001", active: true, name: "Velocity Burst", severity: "HIGH", parameters: { threshold: 10 }, description: "High frequency transactional bursts" },
                "ID-001": { id: "ID-001", active: true, name: "Identity Node Check", severity: "CRITICAL", parameters: {}, description: "Verified KYC status verification" }
            },
            decision_matrix: {
                auto_block: { risk_score_threshold: 85, critical_rule_failures: 1 },
                hold_for_review: { risk_score_threshold: 30 },
                score_weights: { CRITICAL: 100, HIGH: 40, MEDIUM: 20, LOW: 5 }
            }
        };
    }
}

export const ConfigClient = RulesConfigClient.getInstance();
