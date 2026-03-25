import { WebSocket } from 'ws';
import { getAdminSupabase } from '../../services/supabaseClient.js';

class SocketRegistryService {
    private clients: Map<string, Set<WebSocket>> = new Map();
    private isListening = false;

    constructor() {
        this.setupRealtime();
    }

    private setupRealtime() {
        if (this.isListening) return;
        const sb = getAdminSupabase();
        if (!sb) {
            console.warn("[SocketRegistry] Supabase client not available. Cross-node broadcast disabled.");
            return;
        }

        sb.channel('system_broadcasts')
            .on('broadcast', { event: 'user_notification' }, (payload) => {
                const { userId, message } = payload.payload;
                this.sendLocal(userId, message);
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    this.isListening = true;
                    console.info("[SocketRegistry] Subscribed to Supabase Realtime for cross-node broadcasts.");
                }
            });
    }

    public register(userId: string, ws: WebSocket) {
        const existing = this.clients.get(userId) || new Set<WebSocket>();
        existing.add(ws);
        this.clients.set(userId, existing);
        console.info(`[SocketRegistry] Registered client for user: ${userId} (connections=${existing.size})`);
    }

    public remove(userId: string, ws?: WebSocket) {
        const existing = this.clients.get(userId);
        if (!existing) return;

        if (ws) {
            existing.delete(ws);
            if (existing.size > 0) {
                console.info(`[SocketRegistry] Removed one client for user: ${userId} (connections=${existing.size})`);
                return;
            }
        }

        this.clients.delete(userId);
        console.info(`[SocketRegistry] Removed client registry for user: ${userId}`);
    }

    /**
     * Sends a message to a user. If the user is connected locally, it sends directly.
     * Otherwise, it broadcasts via Supabase Realtime to reach other nodes.
     */
    public async send(userId: string, payload: any) {
        // Try local first
        if (this.sendLocal(userId, payload)) {
            return true;
        }

        // If not local, broadcast to other nodes
        const sb = getAdminSupabase();
        if (sb) {
            try {
                await sb.channel('system_broadcasts').send({
                    type: 'broadcast',
                    event: 'user_notification',
                    payload: { userId, message: payload }
                });
                return true;
            } catch (e) {
                console.error(`[SocketRegistry] Failed to broadcast to ${userId} via Realtime`, e);
            }
        }
        return false;
    }

    private sendLocal(userId: string, payload: any): boolean {
        const clients = this.clients.get(userId);
        if (!clients || clients.size == 0) {
            return false;
        }

        let delivered = false;
        for (const client of [...clients]) {
            if (client.readyState !== WebSocket.OPEN) {
                clients.delete(client);
                continue;
            }

            try {
                client.send(JSON.stringify(payload));
                delivered = true;
            } catch (e) {
                console.error(`[SocketRegistry] Failed to send locally to ${userId}`, e);
                clients.delete(client);
            }
        }

        if (clients.size === 0) {
            this.clients.delete(userId);
        }

        return delivered;
    }

    public broadcast(payload: any) {
        this.clients.forEach((clients, userId) => {
            for (const client of [...clients]) {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(payload));
                } else {
                    clients.delete(client);
                }
            }
            if (clients.size === 0) {
                this.clients.delete(userId);
            }
        });
    }

    /**
     * Notifies a user that their balance has changed.
     */
    public notifyBalanceUpdate(userId: string, walletId: string, newBalance: number) {
        return this.send(userId, {
            type: 'BALANCE_UPDATE',
            payload: { walletId, balance: newBalance, timestamp: Date.now() }
        });
    }

    /**
     * Notifies a user about a transaction status change.
     */
    public notifyTransactionUpdate(userId: string, transaction: any) {
        return this.send(userId, {
            type: 'TRANSACTION_UPDATE',
            payload: { ...transaction, timestamp: Date.now() }
        });
    }
}

export const SocketRegistry = new SocketRegistryService();
