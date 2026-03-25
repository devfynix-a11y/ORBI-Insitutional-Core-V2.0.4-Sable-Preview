
import { getSupabase } from '../services/supabaseClient.js';
import { DigitalMerchant, MerchantCategory } from '../types.js';

export class MerchantService {
    private shouldUseMockFallback(): boolean {
        return process.env.NODE_ENV !== 'production';
    }
    
    /**
     * Fetch all available merchant categories
     */
    public getCategories(): MerchantCategory[] {
        return [
            'bundles', 
            'internet', 
            'utilities', 
            'entertainment', 
            'education', 
            'government', 
            'business', 
            'general'
        ];
    }

    /**
     * Fetch merchants, optionally filtered by category
     */
    public async getMerchants(category?: MerchantCategory): Promise<DigitalMerchant[]> {
        const sb = getSupabase();
        if (!sb) return this.shouldUseMockFallback() ? this.getMockMerchants(category) : [];

        let query = sb.from('merchants').select('*').eq('status', 'ACTIVE');
        
        if (category) {
            query = query.eq('category', category);
        }

        const { data, error } = await query;
        if (error || !data) return this.shouldUseMockFallback() ? this.getMockMerchants(category) : [];

        return data as DigitalMerchant[];
    }

    /**
     * Get a specific merchant by ID
     */
    public async getMerchant(id: string): Promise<DigitalMerchant | null> {
        const sb = getSupabase();
        if (!sb) return this.shouldUseMockFallback() ? this.getMockMerchants().find(m => m.id === id) || null : null;

        const { data } = await sb.from('merchants').select('*').eq('id', id).single();
        if (!data) {
            return this.shouldUseMockFallback() ? this.getMockMerchants().find(m => m.id === id) || null : null;
        }
        return data as DigitalMerchant;
    }

    private getMockMerchants(category?: MerchantCategory): DigitalMerchant[] {
        const mocks: DigitalMerchant[] = [
            { id: 'm_netflix', name: 'Netflix', category: 'entertainment', icon: 'film', color: '#E50914', account_label: 'Subscription', status: 'ACTIVE', created_at: new Date().toISOString() },
            { id: 'm_spotify', name: 'Spotify', category: 'entertainment', icon: 'music', color: '#1DB954', account_label: 'Premium', status: 'ACTIVE', created_at: new Date().toISOString() },
            { id: 'm_kplc', name: 'KPLC Prepaid', category: 'utilities', icon: 'zap', color: '#006837', account_label: 'Meter No', status: 'ACTIVE', created_at: new Date().toISOString() },
            { id: 'm_safaricom', name: 'Safaricom Bundles', category: 'bundles', icon: 'wifi', color: '#43B02A', account_label: 'Phone No', status: 'ACTIVE', created_at: new Date().toISOString() },
            { id: 'm_zuku', name: 'Zuku Fiber', category: 'internet', icon: 'globe', color: '#009FE3', account_label: 'Account No', status: 'ACTIVE', created_at: new Date().toISOString() },
            { id: 'm_nhif', name: 'NHIF', category: 'government', icon: 'activity', color: '#005696', account_label: 'ID Number', status: 'ACTIVE', created_at: new Date().toISOString() },
            { id: 'm_uon', name: 'Univ. of Nairobi', category: 'education', icon: 'book', color: '#B71C1C', account_label: 'Reg Number', status: 'ACTIVE', created_at: new Date().toISOString() }
        ];

        if (category) {
            return mocks.filter(m => m.category === category);
        }
        return mocks;
    }
}

export const Merchants = new MerchantService();
