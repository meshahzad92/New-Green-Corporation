import api from './api';

export interface Expense {
    id: string;
    name: string;
    amount: number;
    quantity: number;
    details?: string;
    expense_date: string;
    created_at: string;
    is_deleted: boolean;
    deleted_at?: string;
}

export interface ExpenseCreate {
    name: string;
    amount: number;
    quantity?: number;
    details?: string;
    expense_date?: string;
}

export interface DailyTotal {
    date: string;
    total: number;
}

export const expenseService = {
    // Get all expenses, optionally filtered by date
    getExpenses: async (expense_date?: string): Promise<Expense[]> => {
        const params = expense_date ? { expense_date } : {};
        const response = await api.get('/expenses/', { params });
        return response.data;
    },

    // Get single expense
    getExpense: async (id: string): Promise<Expense> => {
        const response = await api.get(`/expenses/${id}`);
        return response.data;
    },

    // Create new expense
    createExpense: async (expense: ExpenseCreate): Promise<Expense> => {
        const response = await api.post('/expenses/', expense);
        return response.data;
    },

    // Update expense
    updateExpense: async (id: string, expense: Partial<ExpenseCreate>): Promise<Expense> => {
        const response = await api.put(`/expenses/${id}`, expense);
        return response.data;
    },

    // Delete expense (soft delete)
    deleteExpense: async (id: string): Promise<Expense> => {
        const response = await api.delete(`/expenses/${id}`);
        return response.data;
    },

    // Get daily total for a specific date
    getDailyTotal: async (expense_date: string): Promise<DailyTotal> => {
        const response = await api.get('/expenses/daily-total', {
            params: { expense_date }
        });
        return response.data;
    },

    // Get expenses by date range
    getExpensesByDateRange: async (start_date: string, end_date: string): Promise<any[]> => {
        const response = await api.get('/expenses/date-range', {
            params: { start_date, end_date }
        });
        return response.data;
    }
};
