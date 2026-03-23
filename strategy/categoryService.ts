
import { Category } from '../types.js';
import { Storage, STORAGE_KEYS } from '../backend/storage.js';
import { getSupabase } from '../services/supabaseClient.js';
import { DataVault } from '../backend/security/encryption.js';

export class CategoryService {
    async getFromDBLocal(): Promise<Category[]> {
        const raw = Storage.getFromDB(STORAGE_KEYS.CATEGORIES) as any[];
        return this.hydrateCategories(raw);
    }

    async fetchForUser(userId: string): Promise<Category[]> {
        const sb = getSupabase();
        if (!sb) return this.getFromDBLocal();

        const { data, error } = await sb.from('categories').select('*').eq('user_id', userId);
        if (error || !data) return [];

        return this.hydrateCategories(data);
    }

    private async hydrateCategories(raw: any[]): Promise<Category[]> {
        return await Promise.all(raw.map(async c => ({
            ...c,
            budget: typeof c.budget === 'string' ? Number(await DataVault.decrypt(c.budget)) : c.budget
        })));
    }

    async postCategory(c: Category) { 
        const encryptedBudget = await DataVault.encrypt(c.budget);
        const sb = getSupabase();
        if (sb) {
            await sb.from('categories').upsert({ ...c, budget: encryptedBudget });
        }

        let items = Storage.getFromDB<any>(STORAGE_KEYS.CATEGORIES); 
        const index = items.findIndex((item: any) => String(item.id) === String(c.id));
        if (index === -1) {
            items.push({ ...c, budget: encryptedBudget });
        } else {
            items[index] = { ...items[index], ...c, budget: encryptedBudget };
        }
        Storage.saveToDB(STORAGE_KEYS.CATEGORIES, items); 
        return { data: c, error: null }; 
    }

    // Fixed: Added missing updateCategory method
    async updateCategory(c: Category) { 
        const encryptedBudget = await DataVault.encrypt(c.budget);
        const sb = getSupabase();
        if (sb) {
            await sb.from('categories').update({ ...c, budget: encryptedBudget }).eq('id', c.id);
        }
        let items = Storage.getFromDB<any>(STORAGE_KEYS.CATEGORIES);
        const index = items.findIndex((item: any) => String(item.id) === String(c.id));
        if (index !== -1) {
            items[index] = { ...items[index], ...c, budget: encryptedBudget };
            Storage.saveToDB(STORAGE_KEYS.CATEGORIES, items);
        }
        return { error: null }; 
    }

    async deleteCategory(id: string) { 
        const sb = getSupabase();
        if (sb) await sb.from('categories').delete().eq('id', id);
        let items = Storage.getFromDB<any>(STORAGE_KEYS.CATEGORIES);
        items = items.filter((item: any) => String(item.id) !== String(id));
        Storage.saveToDB(STORAGE_KEYS.CATEGORIES, items);
        return { error: null }; 
    }
}
