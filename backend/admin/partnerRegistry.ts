import { getAdminSupabase } from '../supabaseClient.js';
import { FinancialPartner } from '../../types.js';
import { secureProviderRegistryPayload } from '../payments/providers/RegistryPayloadSecurity.js';
import { normalizeFinancialPartnerInput } from '../payments/providers/ProviderRegistryValidator.js';

export class PartnerRegistry {
    private static sb = getAdminSupabase();

    public static async listPartners() {
        return await this.sb!.from('financial_partners').select('*');
    }

    public static async addPartner(partner: Omit<FinancialPartner, 'id' | 'created_at'>) {
        const normalized = normalizeFinancialPartnerInput({
            ...partner,
            logic_type: partner.logic_type || 'REGISTRY',
        });
        const secured = await secureProviderRegistryPayload({
            ...normalized,
        });
        return await this.sb!.from('financial_partners').insert(secured);
    }

    public static async updatePartner(id: string, updates: Partial<FinancialPartner>) {
        const normalized = normalizeFinancialPartnerInput(updates, 'update');
        const secured = await secureProviderRegistryPayload(normalized);
        return await this.sb!.from('financial_partners').update(secured).eq('id', id);
    }

    public static async deletePartner(id: string) {
        return await this.sb!.from('financial_partners').delete().eq('id', id);
    }
}
