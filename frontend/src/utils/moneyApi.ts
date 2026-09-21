import api from './api';

export interface MoneyAccount {
  id: string;
  title: string;
  bank_name?: string;
  account_type: 'BANK' | 'CASH';
  account_number?: string;
  opening_balance: number;
  current_balance: number;
  created_at: string;
  is_deleted?: boolean;
}

export interface MoneyTransaction {
  id: string;
  account_id: string;
  transaction_date: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'OPENING' | 'COMPANY_PAYMENT';
  amount: number;
  payment_method?: string;
  description?: string;
  tid?: string;
  company_khata_entry_id?: string;
  running_balance?: number;
  created_at: string;
  is_deleted?: boolean;
}

export interface MoneyAccountLedger {
  account: MoneyAccount;
  transactions: MoneyTransaction[];
  total_deposits: number;
  total_withdrawals: number;
  current_balance: number;
}

export interface MoneyTransferData {
  account_id: string;
  transfer_to_type: 'COMPANY' | 'PERSON';
  company_khata_account_id?: string;
  person_name?: string;
  person_account?: string;
  amount: number;
  transaction_date?: string;
  payment_method?: string;
  tid?: string;
  description?: string;
}

export const moneyService = {
  getAccounts: (): Promise<MoneyAccount[]> =>
    api.get('/money/accounts').then(r => r.data),

  createAccount: (data: {
    title: string;
    bank_name?: string;
    account_type?: string;
    account_number?: string;
    opening_balance?: number;
  }): Promise<MoneyAccount> =>
    api.post('/money/accounts', data).then(r => r.data),

  updateAccount: (id: string, data: {
    title?: string;
    bank_name?: string;
    account_type?: string;
    account_number?: string;
  }): Promise<MoneyAccount> =>
    api.put(`/money/accounts/${id}`, data).then(r => r.data),

  deleteAccount: (id: string): Promise<void> =>
    api.delete(`/money/accounts/${id}`).then(r => r.data),

  getLedger: (accountId: string): Promise<MoneyAccountLedger> =>
    api.get(`/money/accounts/${accountId}/ledger`).then(r => r.data),

  createTransaction: (data: {
    account_id: string;
    transaction_date?: string;
    type: 'DEPOSIT' | 'WITHDRAWAL';
    amount: number;
    payment_method?: string;
    description?: string;
    tid?: string;
  }): Promise<MoneyTransaction> =>
    api.post('/money/transactions', data).then(r => r.data),

  createTransfer: (data: MoneyTransferData): Promise<MoneyTransaction> =>
    api.post('/money/transfers', data).then(r => r.data),

  updateTransaction: (id: string, data: {
    transaction_date?: string;
    amount?: number;
    payment_method?: string;
    description?: string;
    tid?: string;
  }): Promise<MoneyTransaction> =>
    api.put(`/money/transactions/${id}`, data).then(r => r.data),

  deleteTransaction: (id: string): Promise<void> =>
    api.delete(`/money/transactions/${id}`).then(r => r.data),
};
