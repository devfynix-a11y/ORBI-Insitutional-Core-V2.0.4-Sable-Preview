
import { Task } from '../types.js';
import { Storage, STORAGE_KEYS } from '../backend/storage.js';
import { getSupabase } from '../services/supabaseClient.js';

export class TaskService {
    async getFromDBLocal(): Promise<Task[]> {
        return Storage.getFromDB<Task>(STORAGE_KEYS.TASKS);
    }

    async fetchForUser(userId: string): Promise<Task[]> {
        const sb = getSupabase();
        if (!sb) return this.getFromDBLocal();
        const { data } = await sb.from('tasks').select('*').eq('user_id', userId);
        if (!data) return [];
        return data.map((d: any) => ({
            id: d.id,
            text: d.text,
            completed: d.completed,
            createdAt: d.created_at,
            user_id: d.user_id,
            linkedGoalId: d.linked_goal_id,
            bounty: d.bounty,
            dueDate: d.due_date
        }));
    }

    async postTask(t: Task) { 
        const sb = getSupabase();
        if (sb) {
            await sb.from('tasks').upsert({ 
                id: t.id, 
                text: t.text, 
                completed: t.completed, 
                user_id: t.user_id, 
                created_at: t.createdAt, 
                due_date: t.dueDate,
                linked_goal_id: t.linkedGoalId,
                bounty: t.bounty
            });
        }

        let items = Storage.getFromDB<Task>(STORAGE_KEYS.TASKS); 
        const index = items.findIndex(item => String(item.id) === String(t.id));
        if (index === -1) {
            items.push(t);
        } else {
            items[index] = { ...items[index], ...t };
        }
        Storage.saveToDB(STORAGE_KEYS.TASKS, items); 
        return { data: t, error: null }; 
    }

    // Fixed: Added missing updateTask method
    async updateTask(t: Task) { 
        const sb = getSupabase();
        if (sb) {
            await sb.from('tasks').update({ 
                text: t.text, 
                completed: t.completed, 
                due_date: t.dueDate,
                linked_goal_id: t.linkedGoalId,
                bounty: t.bounty
            }).eq('id', t.id);
        }
        let items = Storage.getFromDB<Task>(STORAGE_KEYS.TASKS);
        const index = items.findIndex(item => String(item.id) === String(t.id));
        if (index !== -1) {
            items[index] = { ...items[index], ...t };
            Storage.saveToDB(STORAGE_KEYS.TASKS, items);
        }
        return { error: null }; 
    }

    async deleteTask(id: string) { 
        const sb = getSupabase();
        if (sb) await sb.from('tasks').delete().eq('id', id);
        let items = Storage.getFromDB<Task>(STORAGE_KEYS.TASKS);
        items = items.filter(item => String(item.id) !== String(id));
        Storage.saveToDB(STORAGE_KEYS.TASKS, items);
        return { error: null }; 
    }
}
