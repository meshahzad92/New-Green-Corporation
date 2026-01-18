import React, { createContext, useContext, useState, useEffect } from 'react';
import { Company, Product, Stock, Sale, StockTransaction } from '../types';
import api from '../utils/api';
import { useAuth } from './AuthContext';

interface DataContextType {
  companies: Company[];
  products: Product[];
  stocks: Stock[];
  stockTransactions: StockTransaction[];
  sales: Sale[];
  loading: boolean;
  refreshData: () => Promise<void>;
  addCompany: (name: string) => Promise<void>;
  updateCompany: (id: string, name: string) => Promise<void>;
  deleteCompany: (id: string) => Promise<boolean>;
  addProduct: (product: Omit<Product, 'id' | 'purchasePrice'>) => Promise<void>;
  updateProduct: (id: string, product: Omit<Product, 'id'>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  addStock: (productId: string, quantity: number, partyName: string, purchasePrice: number) => Promise<void>;
  addSale: (productId: string, quantity: number, customerName: string, sellingPrice: number, paymentType: 'Credit' | 'Debit', customerPhone?: string, saleDate?: Date) => Promise<boolean>;
  updateSale: (id: string, updates: Partial<{ productId: string, quantity: number, customerName: string, sellingPrice: number, paymentType: 'Credit' | 'Debit', customerPhone: string }>) => Promise<boolean>;
  deleteSale: (id: string) => Promise<void>;
  deleteStockTransaction: (id: string) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [stockTransactions, setStockTransactions] = useState<StockTransaction[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const { isLoggedIn } = useAuth();

  const refreshData = async () => {
    if (!isLoggedIn) return;
    setLoading(true);
    try {
      const [prodRes, transRes, saleRes, compRes] = await Promise.all([
        api.get('/products/'),
        api.get('/transactions'),
        api.get('/sales'),
        api.get('/companies/')
      ]);

      setCompanies(compRes.data.map((c: any) => ({
        id: c.id,
        name: c.name,
        createdAt: c.created_at
      })).sort((a: any, b: any) => a.name.localeCompare(b.name)));

      // Map backend products to frontend Product type
      const mappedProducts: Product[] = prodRes.data.map((p: any) => ({
        id: p.id,
        companyId: p.company_id,
        name: p.name,
        category: p.category,
        unit: p.unit,
        purchasePrice: parseFloat(p.purchase_price),
        minStock: p.min_stock
      }));

      // Map backend products to Stock type (using current_stock returned from backend)
      const mappedStocks: Stock[] = prodRes.data.map((p: any) => ({
        productId: p.id,
        totalIn: 0, // Backend doesn't return totalIn/Out directly in list, but we have current_stock
        totalOut: 0,
        remaining: p.current_stock || 0
      }));

      setProducts(mappedProducts);
      setStocks(mappedStocks);
      setStockTransactions(transRes.data.map((t: any) => ({
        id: t.id,
        productId: t.product_id,
        quantity: t.quantity,
        partyName: t.party_name,
        purchasePrice: parseFloat(t.purchase_price || 0),
        type: t.type,
        date: t.created_at
      })));
      setSales(saleRes.data.map((s: any) => ({
        id: s.id,
        productId: s.product_id,
        quantity: s.quantity,
        sellingPrice: parseFloat(s.selling_price),
        purchasePrice: parseFloat(s.purchase_price),
        customerName: s.customer_name,
        customerPhone: s.customer_phone,
        totalAmount: parseFloat(s.total_amount),
        paymentType: s.payment_type,
        date: s.created_at
      })));
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, [isLoggedIn]);

  const addCompany = async (name: string) => {
    try {
      await api.post('/companies/', { name });
      await refreshData();
    } catch (error) {
      console.error('Failed to add company:', error);
    }
  };

  const updateCompany = async (id: string, name: string) => {
    try {
      await api.put(`/companies/${id}`, { name });
      await refreshData();
    } catch (error) {
      console.error('Failed to update company:', error);
    }
  };

  const deleteCompany = async (id: string): Promise<boolean> => {
    try {
      await api.delete(`/companies/${id}`);
      await refreshData();
      return true;
    } catch (error) {
      console.error('Failed to delete company:', error);
      return false;
    }
  };

  const addProduct = async (productData: Omit<Product, 'id' | 'purchasePrice'>) => {
    try {
      await api.post('/products/', {
        name: productData.name,
        category: productData.category,
        unit: productData.unit,
        min_stock: productData.minStock,
        company_id: productData.companyId
      });
      await refreshData();
    } catch (error) {
      console.error('Failed to add product:', error);
    }
  };

  const updateProduct = async (id: string, productData: Omit<Product, 'id'>) => {
    try {
      await api.put(`/products/${id}`, {
        name: productData.name,
        category: productData.category,
        unit: productData.unit,
        purchase_price: productData.purchasePrice,
        min_stock: productData.minStock,
        company_id: productData.companyId
      });
      await refreshData();
    } catch (error) {
      console.error('Failed to update product:', error);
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      await api.delete(`/products/${id}`);
      await refreshData();
    } catch (error) {
      console.error('Failed to delete product:', error);
    }
  };

  const addStock = async (productId: string, quantity: number, partyName: string, purchasePrice: number) => {
    try {
      await api.post('/transactions', {
        product_id: productId,
        quantity,
        party_name: partyName,
        purchase_price: purchasePrice,
        type: 'IN'
      });
      await refreshData();
    } catch (error) {
      console.error('Failed to add stock:', error);
    }
  };

  const addSale = async (productId: string, quantity: number, customerName: string, sellingPrice: number, paymentType: 'Credit' | 'Debit', customerPhone?: string, saleDate?: Date): Promise<boolean> => {
    try {
      const payload: any = {
        product_id: productId,
        quantity,
        customer_name: customerName,
        customer_phone: customerPhone,
        selling_price: sellingPrice,
        payment_type: paymentType
      };

      // Add custom date if provided
      if (saleDate) {
        payload.created_at = saleDate.toISOString();
      }

      await api.post('/sales', payload);
      await refreshData();
      return true;
    } catch (error) {
      console.error('Failed to add sale:', error);
      return false;
    }
  };

  const updateSale = async (id: string, updates: Partial<{ productId: string, quantity: number, customerName: string, sellingPrice: number, paymentType: 'Credit' | 'Debit', customerPhone: string }>): Promise<boolean> => {
    try {
      const payload: any = {};
      if (updates.productId !== undefined) payload.product_id = updates.productId;
      if (updates.quantity !== undefined) payload.quantity = updates.quantity;
      if (updates.customerName !== undefined) payload.customer_name = updates.customerName;
      if (updates.customerPhone !== undefined) payload.customer_phone = updates.customerPhone;
      if (updates.sellingPrice !== undefined) payload.selling_price = updates.sellingPrice;
      if (updates.paymentType !== undefined) payload.payment_type = updates.paymentType;

      await api.put(`/sales/${id}`, payload);
      await refreshData();
      return true;
    } catch (error) {
      console.error('Failed to update sale:', error);
      return false;
    }
  };

  const deleteSale = async (id: string) => {
    try {
      await api.delete(`/sales/${id}`);
      await refreshData();
    } catch (error) {
      console.error('Failed to delete sale:', error);
    }
  };

  const deleteStockTransaction = async (id: string) => {
    try {
      await api.delete(`/transactions/${id}`);
      await refreshData();
    } catch (error) {
      console.error('Failed to delete transaction:', error);
    }
  };

  return (
    <DataContext.Provider value={{
      companies, products, stocks, stockTransactions, sales, loading, refreshData,
      addCompany, updateCompany, deleteCompany,
      addProduct, updateProduct, deleteProduct,
      addStock, deleteStockTransaction,
      addSale, updateSale, deleteSale
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within DataProvider');
  return context;
};
