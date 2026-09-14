
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
  purchasePrice: number; // Represents the LATEST purchase price (MRP - discount)
  mrp?: number;          // Maximum Retail Price set by company
  companyDiscount?: number; // Discount % given by company (e.g. 10 = 10%)
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
  mrp?: number;
  companyDiscount?: number;
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
  paidAmount?: number;
  invoiceId?: string;
  invoiceNo?: string;
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
