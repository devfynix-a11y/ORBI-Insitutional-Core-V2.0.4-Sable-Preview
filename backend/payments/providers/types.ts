
import { FinancialPartner } from '../../../types.js';

export interface ProviderResponse {
    success: boolean;
    providerRef: string;
    message: string;
    rawPayload?: any;
}

export interface ProviderCallbackResult {
    reference: string;
    status: 'completed' | 'failed' | 'processing' | 'pending';
    message: string;
    providerEventId?: string;
    rawStatus?: string;
}

/**
 * SOVEREIGN PROVIDER CONTRACT
 * Every external node (Airtel, M-Pesa, Bank) must implement this.
 */
export interface IPaymentProvider {
    /**
     * Technical Handshake / OAuth
     */
    authenticate(partner: FinancialPartner): Promise<string>;

    /**
     * Cash-In (Customer to Platform)
     */
    stkPush(partner: FinancialPartner, phone: string, amount: number, reference: string): Promise<ProviderResponse>;

    /**
     * Cash-Out (Platform to Customer/Entity)
     */
    disburse(partner: FinancialPartner, phone: string, amount: number, reference: string): Promise<ProviderResponse>;

    /**
     * Webhook Parsing
     * Translates provider-specific JSON into DilPesa standardized status.
     */
    parseCallback(
        payload: any,
        partner?: FinancialPartner,
        context?: { headers?: Record<string, string | undefined> },
    ): ProviderCallbackResult;

    /**
     * Get current partner vault balance
     */
    getBalance(partner: FinancialPartner): Promise<number>;
}
