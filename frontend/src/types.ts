
export interface Company {
  id: string;
  name: string;
  createdAt: string;
}

export interface Product {
  id: string;
  companyId: string;
  name: string;
  category: string;
  unit: string;
  purchasePrice: number; // Represents the LATEST purchase price
  minStock: number;
}

export interface Stock {
  productId: string;
  totalIn: number;
  totalOut: number;
  remaining: number;
}

export interface StockTransaction {
  id: string;
  productId: string;
  quantity: number;
  partyName: string;
  purchasePrice: number;
  type: 'IN' | 'OUT';
  date: string;
}

export interface Sale {
  id: string;
  productId: string;
  quantity: number;
  sellingPrice: number;
  purchasePrice: number; // Historical cost at time of sale for profit tracking
  customerName: string;
  customerPhone?: string; // Optional phone number for credit follow-ups
  totalAmount: number;
  paymentType: 'Credit' | 'Debit'; // Credit = Unpaid (Red), Debit = Paid (Green)
  date: string;
}

export interface AppData {
  companies: Company[];
  products: Product[];
  stocks: Stock[];
  stockTransactions: StockTransaction[];
  sales: Sale[];
}
