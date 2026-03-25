
import { IPaymentProvider } from './types.js';
import { GenericRestProvider } from './GenericRestProvider.js';
import { FinancialPartner } from '../../../types.js';

export class ProviderFactory {
    private static registryProvider: IPaymentProvider | null = null;

    /**
     * REGISTRY-DRIVEN PROVIDER RESOLVER
     * All provider behavior is loaded from the configured partner registry.
     * No provider is selected by hardcoded class name matching.
     */
    public static getProvider(partner: FinancialPartner): IPaymentProvider {
        if (!partner.mapping_config) {
            throw new Error(`PROVIDER_REGISTRY_CONFIG_MISSING: ${partner.name}`);
        }
        if (!this.registryProvider) {
            this.registryProvider = new GenericRestProvider();
        }
        return this.registryProvider;
    }
}
