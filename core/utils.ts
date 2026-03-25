
import { Transaction, Goal, UserRole, Permission } from './types.js';
import { PLATFORM_LOGO_LINK } from '../services/platform_Logo.js';

export const APP_LOGO_URL = PLATFORM_LOGO_LINK;

export const DateUtils = {
    getSystemTimezone: () => {
        try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { return 'UTC'; }
    },

    safeParse: (ds: string) => {
        if (!ds) return new Date();
        if (ds.includes(':') && !ds.includes('Z') && !ds.includes('+')) {
            return new Date(ds.replace(' ', 'T') + 'Z');
        }
        return new Date(ds);
    },

    formatDate: (ds: string) => {
        if (!ds) return 'N/A';
        const d = DateUtils.safeParse(ds);
        const now = new Date();
        const diff = Math.floor(Math.abs(now.getTime() - d.getTime()) / 86400000);
        if (diff === 0 && d.getDate() === now.getDate()) return 'Today';
        if (diff <= 1 && d.getDate() !== now.getDate()) return 'Yesterday';
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
    },
    
    formatTime: (ds: string) => {
        if (!ds) return '--:--';
        const d = DateUtils.safeParse(ds);
        return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true });
    },

    formatLocalTimeWithZone: (ds: string) => {
        if (!ds) return 'N/A';
        const d = DateUtils.safeParse(ds);
        return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
    }
};

export const CurrencyUtils = {
    CURRENCIES: { 
        USD: { symbol: '$', locale: 'en-US' }, 
        TZS: { symbol: 'TSh', locale: 'sw-TZ' },
        KES: { symbol: 'KSh', locale: 'en-KE' }
    } as any,
    formatMoney: (val: number, code = 'USD') => {
        const c = CurrencyUtils.CURRENCIES[code] || CurrencyUtils.CURRENCIES.USD;
        // NAN PROTECTION: Return 0 formatted currency for invalid numbers
        const num = Number(val);
        const safeVal = isNaN(num) ? 0 : num;
        return new Intl.NumberFormat(c.locale, { style: 'currency', currency: code }).format(safeVal);
    },
    getSymbol: (code = 'USD') => (CurrencyUtils.CURRENCIES[code] || CurrencyUtils.CURRENCIES.USD).symbol,
    formatInput: (v: any) => String(v).replace(/[^0-9.]/g, ''),
    parseInput: (v: any) => parseFloat(String(v).replace(/,/g, '')) || 0
};

export const UUID = {
    generate: (): string => {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
    }
};

export const RBAC = {
    can: (role: UserRole | string | undefined, permission: Permission): boolean => {
        const currentRole = role || 'USER';
        
        // Super Admin Bypass
        if (currentRole === 'SUPER_ADMIN') return true;
        
        const matrix: Record<string, Permission[]> = {
            'ADMIN': [
                'auth.login', 'auth.logout', 'auth.refresh', 'auth.pwd_reset',
                'user.read', 'user.update', 'user.freeze',
                'wallet.read', 'wallet.create', 'wallet.update', 'wallet.delete', 'wallet.credit', 'wallet.debit', 'wallet.freeze',
                'transaction.create', 'transaction.view', 'transaction.verify', 'transaction.reverse',
                'ledger.read', 'ledger.write',
                'admin.approve', 'admin.freeze', 'admin.audit.read'
            ],
            'ACCOUNTANT': [
                'auth.login', 'auth.logout', 'auth.refresh',
                'user.read', 'wallet.read', 'transaction.view',
                'ledger.read', 'ledger.write'
            ],
            'AUDIT': [
                'auth.login', 'auth.logout', 'auth.refresh',
                'user.read', 'wallet.read', 'transaction.view',
                'ledger.read', 'admin.audit.read'
            ],
            'IT': [
                'auth.login', 'auth.logout', 'auth.refresh',
                'user.read', 'admin.audit.read',
                'system.wallet.credit', 'system.wallet.debit'
            ],
            'CUSTOMER_CARE': [
                'auth.login', 'auth.logout', 'auth.refresh', 'auth.pwd_reset',
                'user.read', 'transaction.view'
            ],
            'MERCHANT': [
                'auth.login', 'auth.logout', 'auth.refresh',
                'user.read', 'user.update',
                'wallet.read',
                'transaction.create', 'transaction.view',
                'merchant.read', 'merchant.create', 'merchant.update', 'merchant.settlement'
            ],
            'AGENT': [
                'auth.login', 'auth.logout', 'auth.refresh',
                'user.read', 'user.update',
                'wallet.read',
                'transaction.create', 'transaction.view',
                'agent.cash.deposit', 'agent.cash.withdraw', 'agent.float.manage'
            ],
            'USER': [
                'auth.login', 'auth.logout', 'auth.refresh',
                'user.read', 'user.update',
                'wallet.read', 'wallet.create', 'wallet.update', 'wallet.delete',
                'transaction.create', 'transaction.view',
                'goal.read', 'goal.create', 'goal.update', 'goal.delete',
                'category.read', 'category.create', 'category.update', 'category.delete',
                'task.read', 'task.create', 'task.update', 'task.delete'
            ],
            'CONSUMER': [
                'auth.login', 'auth.logout', 'auth.refresh',
                'user.read', 'user.update',
                'wallet.read', 'wallet.create', 'wallet.update', 'wallet.delete',
                'transaction.create', 'transaction.view'
            ],
            'SYSTEM': [
                'ledger.write', 'system.wallet.credit', 'system.wallet.debit'
            ]
        };

        const allowed = matrix[currentRole] || [];
        return allowed.includes(permission);
    }
};
