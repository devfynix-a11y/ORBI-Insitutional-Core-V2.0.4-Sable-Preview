import { Cluster, Redis } from 'ioredis';
import fs from 'fs';

/**
 * ORBI REDIS CLUSTER FACTORY (V1.3 Titanium)
 * -------------------------------------------
 * Orchestrates secure, high-availability links to the Sovereign Redis Cluster.
 * Now supports Hybrid Mode (Cluster + Standalone).
 */

export type RedisTier = 'session' | 'fraud' | 'monitor';

class RedisClusterFactory {
    private static instances: Map<RedisTier, Cluster | Redis> = new Map();

    private static buildTlsOptions() {
        if (process.env.REDIS_TLS_ENABLED !== 'true') return undefined;

        const allowInsecureTls = process.env.REDIS_ALLOW_INSECURE_TLS === 'true';
        const caPath = process.env.REDIS_CA_CERT_PATH;
        const tlsOptions: any = {
            rejectUnauthorized: !allowInsecureTls,
        };

        if (caPath && fs.existsSync(caPath)) {
            tlsOptions.ca = fs.readFileSync(caPath);
            tlsOptions.minVersion = 'TLSv1.3' as const;
        }

        if (allowInsecureTls) {
            console.warn('[RedisFactory] REDIS_ALLOW_INSECURE_TLS=true. This should only be used in non-production environments.');
        }

        return tlsOptions;
    }

    public static isAvailable(): boolean {
        return !!(process.env.REDIS_CLUSTER_NODES || process.env.REDIS_URL || process.env.REDIS_HOST);
    }

    public static getClient(tier: RedisTier): Cluster | Redis | null {
        if (this.instances.has(tier)) {
            return this.instances.get(tier)!;
        }

        // 1. Standalone Mode (Preferred if REDIS_URL is present)
        if (process.env.REDIS_URL) {
            console.info(`[RedisFactory] Initializing Standalone Link for ${tier}...`);
            try {
                const client = new Redis(process.env.REDIS_URL, {
                    maxRetriesPerRequest: null,
                    enableReadyCheck: false,
                    tls: this.buildTlsOptions(),
                });

                client.on('error', (err) => {
                    // Suppress connection errors to prevent log flooding
                    console.warn(`[Redis:${tier}] Connection instability: ${err.message}`);
                });

                this.instances.set(tier, client);
                return client;
            } catch (e: any) {
                console.error(`[RedisFactory] Standalone Init Failed: ${e.message}`);
            }
        }

        // 2. Cluster Mode
        const nodesStr = process.env.REDIS_CLUSTER_NODES;
        if (nodesStr) {
            const nodes = nodesStr.split(',').map(n => {
                const [host, port] = n.split(':');
                return { host, port: parseInt(port || '6379') };
            });

            const username = process.env[`REDIS_USER_${tier.toUpperCase()}`];
            const password = process.env[`REDIS_PASS_${tier.toUpperCase()}`];
            const tlsOptions = this.buildTlsOptions();

            const cluster = new Cluster(nodes, {
                dnsLookup: (address: string, callback: (err: Error | null, address: string, family?: number) => void) => callback(null, address),
                enableReadyCheck: false,
                redisOptions: {
                    tls: tlsOptions,
                    username,
                    password,
                    connectTimeout: 20000,
                    maxRetriesPerRequest: 5,
                    keepAlive: 30000,
                    showFriendlyErrorStack: process.env.NODE_ENV !== 'production',
                },
                clusterRetryStrategy: (times: number) => {
                    return Math.min(times * 200, 5000);
                },
                slotsRefreshTimeout: 45000, // Increased timeout for slots refresh
                retryDelayOnFailover: 100, // Retry delay on failover
            });

            cluster.on('error', (err: Error) => {
                // Suppress "Failed to refresh slots cache" if it's transient
                if (err.message.includes('Failed to refresh slots cache')) {
                    // console.warn(`[RedisCluster:${tier}] Slots refresh warning (transient): ${err.message}`);
                } else {
                    console.error(`[RedisCluster:${tier}] Functional fault detected:`, err.message);
                }
            });

            this.instances.set(tier, cluster);
            return cluster;
        }

        // 3. Standalone Host Fallback
        if (process.env.REDIS_HOST) {
             const client = new Redis({
                 host: process.env.REDIS_HOST,
                 port: parseInt(process.env.REDIS_PORT || '6379'),
                 password: process.env.REDIS_PASSWORD,
                 tls: this.buildTlsOptions(),
             });
             
             client.on('error', (err) => {
                console.warn(`[Redis:${tier}] Connection instability: ${err.message}`);
             });

             this.instances.set(tier, client);
             return client;
        }

        return null;
    }

    public static async shutdownAll() {
        for (const [tier, client] of this.instances.entries()) {
            console.info(`[RedisFactory] Sending SIGTERM to ${tier} node...`);
            await client.quit();
        }
        this.instances.clear();
    }
}

export { RedisClusterFactory };
