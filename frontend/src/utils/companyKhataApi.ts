import api from './api';

export interface CompanyAccount {
  id: string;
  name: string;
  phone?: string | null;
  catalog_company_id?: string | null;
  catalog_company_name?: string | null;
  catalog_company_logo?: string | null;
  created_at: string;
  is_deleted: boolean;
}

export interface CompanyAccountCreate {
  name: string;
  phone?: string;
  catalog_company_id?: string;
}

export interface CompanyAccountUpdate {
  name?: string;
  phone?: string;
  catalog_company_id?: string;
}

export interface CompanyPurchaseItem {
  product_id: string;
  name?: string;
  quantity: number;
  total_price: number;
  unit_price?: number;
}

export interface CompanyKhataOverview {
  account_id: string;
  company_id: string; // alias
  name: string;
  company_name: string; // alias
  phone?: string | null;
  catalog_company_id?: string | null;
  catalog_company_name?: string | null;
  company_logo?: string | null;
  total_paid: number;
  total_purchased: number;
  net_balance: number;
  balance_status: 'ADVANCE' | 'PAYABLE' | 'SETTLED';
  products_count: number;
  entry_count: number;
}

export interface CompanyKhataEntry {
  id: string;
  account_id?: string | null;
  company_id?: string | null;
  entry_date: string;
  entry_type: 'PAYMENT' | 'PURCHASE';
  amount_paid: number;
  payment_method?: 'CASH' | 'ONLINE' | null;
  bank_name?: string | null;
  transaction_id?: string | null;
  total_purchase_amount: number;
  products_detail?: CompanyPurchaseItem[] | null;
  stock_transaction_ids?: string[] | null;
  remarks?: string | null;
  created_at: string;
  running_balance?: number;
}

export interface CompanyKhataLedger {
  account_id: string;
  company_id: string;
  name: string;
  company_name: string;
  phone?: string | null;
  catalog_company_id?: string | null;
  catalog_company_name?: string | null;
  company_logo?: string | null;
  total_paid: number;
  total_purchased: number;
  net_balance: number;
  balance_status: 'ADVANCE' | 'PAYABLE' | 'SETTLED';
  entries: CompanyKhataEntry[];
}

export interface CompanyPaymentCreate {
  account_id?: string;
  company_id?: string;
  entry_date?: string;
  amount_paid: number;
  payment_method?: 'CASH' | 'ONLINE';
  bank_name?: string;
  transaction_id?: string;
  remarks?: string;
}

export interface CompanyPurchaseCreate {
  account_id?: string;
  company_id?: string;
  entry_date?: string;
  items: Array<{
    product_id: string;
    quantity: number;
    total_price: number;
  }>;
  remarks?: string;
}

export interface CompanyKhataEntryUpdate {
  entry_date?: string;
  amount_paid?: number;
  payment_method?: 'CASH' | 'ONLINE';
  bank_name?: string;
  transaction_id?: string;
  remarks?: string;
}

export const companyKhataService = {
  // Accounts CRUD
  getAccounts: async (): Promise<CompanyAccount[]> => {
    const response = await api.get('/company-khata/accounts');
    return response.data;
  },

  createAccount: async (data: CompanyAccountCreate): Promise<CompanyAccount> => {
    const response = await api.post('/company-khata/accounts', data);
    return response.data;
  },

  getAccount: async (id: string): Promise<CompanyAccount> => {
    const response = await api.get(`/company-khata/accounts/${id}`);
    return response.data;
  },

  updateAccount: async (id: string, data: CompanyAccountUpdate): Promise<CompanyAccount> => {
    const response = await api.put(`/company-khata/accounts/${id}`, data);
    return response.data;
  },

  deleteAccount: async (id: string): Promise<any> => {
    const response = await api.delete(`/company-khata/accounts/${id}`);
    return response.data;
  },

  // Overview & Ledger
  getOverview: async (): Promise<CompanyKhataOverview[]> => {
    const response = await api.get('/company-khata/overview');
    return response.data;
  },

  getLedger: async (accountId: string): Promise<CompanyKhataLedger> => {
    const response = await api.get(`/company-khata/${accountId}/ledger`);
    return response.data;
  },

  // Transactions
  recordPayment: async (data: CompanyPaymentCreate): Promise<CompanyKhataEntry> => {
    const response = await api.post('/company-khata/payment', data);
    return response.data;
  },

  recordPurchase: async (data: CompanyPurchaseCreate): Promise<CompanyKhataEntry> => {
    const response = await api.post('/company-khata/purchase', data);
    return response.data;
  },

  updateEntry: async (id: string, data: CompanyKhataEntryUpdate): Promise<CompanyKhataEntry> => {
    const response = await api.put(`/company-khata/entries/${id}`, data);
    return response.data;
  },

  deleteEntry: async (id: string): Promise<any> => {
    const response = await api.delete(`/company-khata/entries/${id}`);
    return response.data;
  }
};
