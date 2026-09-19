import api from './api';

export interface KhataProductItem {
  product_id: string;
  name: string;
  quantity: number;
  price: number;
  total: number;
}

export interface KhataAccount {
  id: string;
  name: string;
  phone?: string;
  role: string;
  total_credit: number;
  total_recovery: number;
  total_left: number;
  entry_count: number;
  created_at: string;
}

export interface KhataAccountCreate {
  name: string;
  phone?: string;
  role?: string;
}

export interface KhataEntry {
  id: string;
  account_id: string;
  entry_date: string;
  entry_type: 'CREDIT' | 'RECOVERY';
  farmer_name?: string;
  credit_amount: number;
  recovery_amount: number;
  payment_method?: 'CASH' | 'ONLINE';
  bank_name?: string;
  products_detail?: KhataProductItem[];
  invoice_id?: string;
  sale_id?: string;
  remarks?: string;
  running_balance?: number;
  created_at: string;
}

export interface KhataCreditSaleCreate {
  dealer_id: string;
  farmer_name?: string;
  entry_date?: string;
  items: KhataProductItem[];
  remarks?: string;
}

export interface KhataRecoveryCreate {
  dealer_id: string;
  entry_date?: string;
  amount: number;
  payment_method?: 'CASH' | 'ONLINE';
  bank_name?: string;
  remarks?: string;
}

export const khataService = {
  getDealers: async (): Promise<KhataAccount[]> => {
    const response = await api.get('/khata/dealers');
    return response.data;
  },

  getDealer: async (id: string): Promise<KhataAccount> => {
    const response = await api.get(`/khata/dealers/${id}`);
    return response.data;
  },

  createDealer: async (data: KhataAccountCreate): Promise<KhataAccount> => {
    const response = await api.post('/khata/dealers', data);
    return response.data;
  },

  updateDealer: async (id: string, data: Partial<KhataAccountCreate>): Promise<KhataAccount> => {
    const response = await api.put(`/khata/dealers/${id}`, data);
    return response.data;
  },

  deleteDealer: async (id: string): Promise<any> => {
    const response = await api.delete(`/khata/dealers/${id}`);
    return response.data;
  },

  getDealerLedger: async (dealerId: string): Promise<KhataEntry[]> => {
    const response = await api.get(`/khata/dealers/${dealerId}/ledger`);
    return response.data;
  },

  createCreditSale: async (data: KhataCreditSaleCreate): Promise<KhataEntry> => {
    const response = await api.post('/khata/credit-sale', data);
    return response.data;
  },

  createRecovery: async (data: KhataRecoveryCreate): Promise<KhataEntry> => {
    const response = await api.post('/khata/recovery', data);
    return response.data;
  },

  updateEntry: async (entryId: string, data: Partial<KhataEntry>): Promise<KhataEntry> => {
    const response = await api.put(`/khata/entries/${entryId}`, data);
    return response.data;
  },

  deleteEntry: async (entryId: string): Promise<any> => {
    const response = await api.delete(`/khata/entries/${entryId}`);
    return response.data;
  }
};
