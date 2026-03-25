
import { FinancialPartner } from '../../../types.js';
import { IPaymentProvider, ProviderResponse } from './types.js';
import { DataVault } from '../../security/encryption.js';
import { MerchantFabric } from './MerchantFabric.js';

/**
 * M-PESA DARAJA INTEGRATION NODE (V2.0)
 * ------------------------------------
 * Specialized implementation for Safaricom/Vodacom M-Pesa APIs.
 */
export class MpesaProvider implements IPaymentProvider {
    
    public async authenticate(partner: FinancialPartner): Promise<string> {
        if (partner.token_cache && partner.token_expiry && partner.token_expiry > Date.now()) {
            const cachedToken = await DataVault.decrypt(partner.token_cache);
            if (typeof cachedToken === 'string' && cachedToken.trim().length > 0) {
                return cachedToken;
            }
        }

        // M-Pesa uses Basic Auth to get a Bearer token
        const decryptedSecret = await DataVault.decrypt(partner.client_secret || '');
        if (!partner.client_id || !decryptedSecret || typeof decryptedSecret !== 'string') {
            throw new Error('MPESA_CLIENT_CREDENTIALS_MISSING');
        }
        const auth = btoa(`${partner.client_id}:${decryptedSecret}`);
        
        console.info(`[M-Pesa] Requesting OAuth token for ${partner.name}`);
        
        // Mocking the Safaricom OAuth response
        const mockToken = `mpesa_token_${Math.random().toString(36).substring(7)}`;
        await MerchantFabric.updatePartnerToken(partner.id, mockToken, 3599);
        
        return mockToken;
    }

    public async stkPush(partner: FinancialPartner, phone: string, amount: number, reference: string): Promise<ProviderResponse> {
        const token = await this.authenticate(partner);
        
        // M-Pesa Specific Payload (Daraja Format)
        const payload = {
            BusinessShortCode: "174379",
            Password: "MTc0Mzc5YmZiMjc5ZjlhYTliZGJj...REDACTED",
            Timestamp: "20231010120101",
            TransactionType: "CustomerPayBillOnline",
            Amount: amount,
            PartyA: phone,
            PartyB: "174379",
            PhoneNumber: phone,
            CallBackURL: `${process.env.BACKEND_URL}/api/webhooks/mpesa`,
            AccountReference: reference,
            TransactionDesc: "ORBI_SETTLEMENT"
        };

        console.info(`[M-Pesa] Dispatching C2B STK Push for ${reference}`);
        
        return {
            success: true,
            providerRef: `MP-${Math.random().toString(36).substring(7).toUpperCase()}`,
            message: "M-Pesa validation request pushed to handset."
        };
    }

    public async disburse(partner: FinancialPartner, phone: string, amount: number, reference: string): Promise<ProviderResponse> {
        return {
            success: true,
            providerRef: `MP-B2C-${Math.random().toString(36).substring(7).toUpperCase()}`,
            message: "M-Pesa B2C sequence accepted."
        };
    }

    public parseCallback(payload: any) {
        // M-Pesa Callback Structure (Result.ResultCode)
        const isSuccess = payload?.Body?.stkCallback?.ResultCode === 0;
        return {
            reference: payload?.Body?.stkCallback?.CheckoutRequestID || '',
            status: (isSuccess ? 'completed' : 'failed') as any,
            message: payload?.Body?.stkCallback?.ResultDesc || 'M-Pesa Signal Processed'
        };
    }

    public async getBalance(partner: FinancialPartner): Promise<number> {
        // M-Pesa specific balance check
        console.info(`[M-Pesa] Checking balance for ${partner.name}`);
        return 500000; // Simulated balance
    }
}
