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
  addStock: (productId: string, quantity: number, partyName: string, purchasePrice: number, mrp?: number, companyDiscount?: number) => Promise<void>;
  addSale: (productId: string, quantity: number, customerName: string, sellingPrice: number, paymentType: 'Credit' | 'Debit', customerPhone?: string, saleDate?: Date, paidAmount?: number) => Promise<boolean>;
  addBulkSale: (customerName: string, items: Array<{ productId: string; quantity: number; sellingPrice: number }>, paymentType: 'Credit' | 'Debit', customerPhone?: string, saleDate?: Date, paidAmount?: number) => Promise<boolean>;
  updateSale: (id: string, updates: Partial<{ productId: string, quantity: number, customerName: string, sellingPrice: number, paymentType: 'Credit' | 'Debit', customerPhone: string, paidAmount: number, saleDate: Date }>) => Promise<boolean>;
  deleteSale: (id: string) => Promise<void>;
  deleteInvoice: (invoiceId: string) => Promise<void>;
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

      // Map backend products to frontend Product type with latest active refill pricing
      const mappedProducts: Product[] = prodRes.data.map((p: any) => {
        let pPrice = parseFloat(p.purchase_price) || 0;
        let pMrp = p.mrp ? parseFloat(p.mrp) : undefined;
        let pDiscount = p.company_discount !== null && p.company_discount !== undefined ? parseFloat(p.company_discount) : undefined;

        // If backend values are missing or zero, check active non-deleted IN transactions for this product
        const productInTransactions = transRes.data
          .filter((t: any) => t.product_id === p.id && t.type === 'IN')
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        if (productInTransactions.length > 0) {
          const latestIn = productInTransactions[0];
          if (pPrice <= 0 && parseFloat(latestIn.purchase_price) > 0) {
            pPrice = parseFloat(latestIn.purchase_price);
          }
          if (!pMrp && latestIn.mrp) {
            pMrp = parseFloat(latestIn.mrp);
          }
          if (pDiscount === undefined && latestIn.company_discount !== null && latestIn.company_discount !== undefined) {
            pDiscount = parseFloat(latestIn.company_discount);
          }
        } else if (productInTransactions.length === 0) {
          // No IN transactions exist at all for this product (e.g. all were deleted)
          pPrice = 0;
          pMrp = undefined;
          pDiscount = undefined;
        }

        return {
          id: p.id,
          companyId: p.company_id,
          name: p.name,
          category: p.category,
          unit: p.unit,
          purchasePrice: pPrice,
          mrp: pMrp,
          companyDiscount: pDiscount,
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

      // Deduplicate products and stocks by (companyId, normalized name)
      // If duplicates exist, pick the one with remaining > 0 (or highest stock), and aggregate stock values
      const productGroups = new Map<string, Product[]>();
      for (const p of mappedProducts) {
        const key = `${p.companyId || 'nocomp'}-${p.name.trim().toLowerCase()}`;
        const group = productGroups.get(key) || [];
        group.push(p);
        productGroups.set(key, group);
      }

      const deduplicatedProducts: Product[] = [];
      const deduplicatedStocks: Stock[] = [];

      productGroups.forEach((group) => {
        if (group.length === 1) {
          const p = group[0];
          deduplicatedProducts.push(p);
          const st = mappedStocks.find(s => s.productId === p.id);
          if (st) deduplicatedStocks.push(st);
        } else {
          // Find stock for each candidate in group
          const candidates = group.map(p => {
            const st = mappedStocks.find(s => s.productId === p.id);
            return {
              product: p,
              stock: st,
              remaining: st?.remaining || 0,
              totalIn: st?.totalIn || 0,
              totalOut: st?.totalOut || 0,
              hasPrice: (p.purchasePrice && p.purchasePrice > 0) || (p.mrp && p.mrp > 0)
            };
          });

          // Sort so best record comes first (highest remaining stock, has price, etc.)
          candidates.sort((a, b) => {
            if (b.remaining !== a.remaining) return b.remaining - a.remaining;
            if (b.hasPrice !== a.hasPrice) return (b.hasPrice ? 1 : 0) - (a.hasPrice ? 1 : 0);
            return b.totalIn - a.totalIn;
          });

          const primary = candidates[0];
          // Sum up totalIn, totalOut, and remaining across all duplicate entries
          const aggregatedTotalIn = candidates.reduce((sum, c) => sum + c.totalIn, 0);
          const aggregatedTotalOut = candidates.reduce((sum, c) => sum + c.totalOut, 0);
          const aggregatedRemaining = candidates.reduce((sum, c) => sum + c.remaining, 0);

          deduplicatedProducts.push(primary.product);
          deduplicatedStocks.push({
            productId: primary.product.id,
            totalIn: aggregatedTotalIn,
            totalOut: aggregatedTotalOut,
            remaining: aggregatedRemaining
          });
        }
      });

      deduplicatedProducts.sort((a: Product, b: Product) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

      setProducts(deduplicatedProducts);
      setStocks(deduplicatedStocks);
      setStockTransactions(transRes.data.map((t: any) => ({
        id: t.id,
        productId: t.product_id,
        quantity: t.quantity,
        partyName: t.party_name,
        purchasePrice: parseFloat(t.purchase_price || 0),
        mrp: t.mrp ? parseFloat(t.mrp) : undefined,
        companyDiscount: t.company_discount !== null && t.company_discount !== undefined ? parseFloat(t.company_discount) : undefined,
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
          invoiceId: s.invoice_id || undefined,
          invoiceNo: s.invoice_no || undefined,
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

  const addStock = async (productId: string, quantity: number, partyName: string, purchasePrice: number, mrp?: number, companyDiscount?: number) => {
    try {
      await api.post('/transactions', {
        product_id: productId,
        quantity,
        party_name: partyName,
        purchase_price: purchasePrice,
        mrp: mrp !== undefined ? mrp : null,
        company_discount: companyDiscount !== undefined ? companyDiscount : null,
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

  const addBulkSale = async (
    customerName: string,
    items: Array<{ productId: string; quantity: number; sellingPrice: number }>,
    paymentType: 'Credit' | 'Debit',
    customerPhone?: string,
    saleDate?: Date,
    paidAmount?: number
  ): Promise<boolean> => {
    try {
      const payload: any = {
        customer_name: customerName,
        customer_phone: customerPhone || undefined,
        payment_type: paymentType,
        items: items.map(item => ({
          product_id: item.productId,
          quantity: item.quantity,
          selling_price: item.sellingPrice
        }))
      };

      if (paidAmount !== undefined && !isNaN(paidAmount)) {
        payload.paid_amount = paidAmount;
      }

      if (saleDate) {
        payload.created_at = saleDate.toISOString();
      }

      await api.post('/sales/bulk', payload);
      await refreshData();
      return true;
    } catch (error) {
      console.error('Failed to add bulk sale:', error);
      return false;
    }
  };

  const updateSale = async (id: string, updates: Partial<{ productId: string, quantity: number, customerName: string, sellingPrice: number, paymentType: 'Credit' | 'Debit', customerPhone: string, paidAmount: number, saleDate: Date }>): Promise<boolean> => {
    try {
      const payload: any = {};
      if (updates.productId !== undefined) payload.product_id = updates.productId;
      if (updates.quantity !== undefined) payload.quantity = updates.quantity;
      if (updates.customerName !== undefined) payload.customer_name = updates.customerName;
      if (updates.customerPhone !== undefined) payload.customer_phone = updates.customerPhone;
      if (updates.sellingPrice !== undefined) payload.selling_price = updates.sellingPrice;
      if (updates.paymentType !== undefined) payload.payment_type = updates.paymentType;
      if (updates.paidAmount !== undefined) payload.paid_amount = updates.paidAmount;
      if (updates.saleDate !== undefined) payload.created_at = updates.saleDate.toISOString();

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

  const deleteInvoice = async (invoiceId: string) => {
    try {
      await api.delete(`/sales/invoice/${invoiceId}`);
      await refreshData();
    } catch (error) {
      console.error('Failed to delete invoice:', error);
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
      addSale, addBulkSale, updateSale, deleteSale, deleteInvoice
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
