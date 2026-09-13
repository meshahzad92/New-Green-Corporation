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
  addSale: (productId: string, quantity: number, customerName: string, sellingPrice: number, paymentType: 'Credit' | 'Debit', customerPhone?: string, saleDate?: Date, paidAmount?: number) => Promise<boolean>;
  updateSale: (id: string, updates: Partial<{ productId: string, quantity: number, customerName: string, sellingPrice: number, paymentType: 'Credit' | 'Debit', customerPhone: string, paidAmount: number }>) => Promise<boolean>;
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

      // Map backend products to frontend Product type with fallback for purchase_price
      const mappedProducts: Product[] = prodRes.data.map((p: any) => {
        let pPrice = parseFloat(p.purchase_price) || 0;
        if (pPrice <= 0) {
          const productInTransactions = transRes.data
            .filter((t: any) => t.product_id === p.id && t.type === 'IN' && parseFloat(t.purchase_price) > 0)
            .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          if (productInTransactions.length > 0) {
            pPrice = parseFloat(productInTransactions[0].purchase_price);
          }
        }
        return {
          id: p.id,
          companyId: p.company_id,
          name: p.name,
          category: p.category,
          unit: p.unit,
          purchasePrice: pPrice,
          minStock: p.min_stock
        };
      });

      // Map backend products to Stock type (computing arrivals and sales)
      const mappedStocks: Stock[] = prodRes.data.map((p: any) => {
        const totalIn = transRes.data
          .filter((t: any) => t.product_id === p.id && t.type === 'IN')
          .reduce((sum: number, t: any) => sum + (t.quantity || 0), 0);
        const outFromTrans = transRes.data
          .filter((t: any) => t.product_id === p.id && t.type === 'OUT')
          .reduce((sum: number, t: any) => sum + (t.quantity || 0), 0);
        const outFromSales = saleRes.data
          .filter((s: any) => s.product_id === p.id)
          .reduce((sum: number, s: any) => sum + (s.quantity || 0), 0);
        const totalOut = Math.max(outFromTrans, outFromSales);

        return {
          productId: p.id,
          totalIn,
          totalOut,
          remaining: p.current_stock || 0
        };
      });

      mappedProducts.sort((a: Product, b: Product) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

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
      })).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setSales(saleRes.data.map((s: any) => {
        const total = parseFloat(s.total_amount || 0);
        const paid = s.paid_amount !== undefined && s.paid_amount !== null
          ? parseFloat(s.paid_amount)
          : (s.payment_type === 'Debit' ? total : 0);
        return {
          id: s.id,
          productId: s.product_id,
          quantity: s.quantity,
          sellingPrice: parseFloat(s.selling_price),
          purchasePrice: parseFloat(s.purchase_price),
          customerName: s.customer_name,
          customerPhone: s.customer_phone,
          totalAmount: total,
          paidAmount: paid,
          paymentType: s.payment_type,
          date: s.created_at
        };
      }).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()));
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
      const payload: any = {
        name: productData.name,
        category: productData.category,
        unit: productData.unit,
        min_stock: productData.minStock,
        company_id: productData.companyId
      };
      if (productData.purchasePrice && productData.purchasePrice > 0) {
        payload.purchase_price = productData.purchasePrice;
      }
      await api.put(`/products/${id}`, payload);
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

  const addSale = async (productId: string, quantity: number, customerName: string, sellingPrice: number, paymentType: 'Credit' | 'Debit', customerPhone?: string, saleDate?: Date, paidAmount?: number): Promise<boolean> => {
    try {
      const payload: any = {
        product_id: productId,
        quantity,
        customer_name: customerName,
        customer_phone: customerPhone,
        selling_price: sellingPrice,
        payment_type: paymentType
      };

      if (paidAmount !== undefined && !isNaN(paidAmount)) {
        payload.paid_amount = paidAmount;
      }

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

  const updateSale = async (id: string, updates: Partial<{ productId: string, quantity: number, customerName: string, sellingPrice: number, paymentType: 'Credit' | 'Debit', customerPhone: string, paidAmount: number }>): Promise<boolean> => {
    try {
      const payload: any = {};
      if (updates.productId !== undefined) payload.product_id = updates.productId;
      if (updates.quantity !== undefined) payload.quantity = updates.quantity;
      if (updates.customerName !== undefined) payload.customer_name = updates.customerName;
      if (updates.customerPhone !== undefined) payload.customer_phone = updates.customerPhone;
      if (updates.sellingPrice !== undefined) payload.selling_price = updates.sellingPrice;
      if (updates.paymentType !== undefined) payload.payment_type = updates.paymentType;
      if (updates.paidAmount !== undefined) payload.paid_amount = updates.paidAmount;

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
