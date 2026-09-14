
import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Sale } from '../types';
import { ShoppingCart, Search, Calendar, Filter, User, Wallet, CreditCard, Download, Phone, Trash2, Pencil, Plus, X } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import CustomDatePicker from '../components/CustomDatePicker';

interface AddSaleItem {
  id: string;
  companyId: string;
  search: string;
  productId: string;
  quantity: string;
  totalAmount: string;
  price: string;
}

const createInitialSaleItem = (): AddSaleItem => ({
  id: Math.random().toString(36).substring(2, 9),
  companyId: 'all',
  search: '',
  productId: '',
  quantity: '1',
  totalAmount: '',
  price: '0'
});

const SalesPage: React.FC = () => {
  const { companies, products, sales, stocks, deleteSale, deleteInvoice, updateSale, addSale, addBulkSale } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [timeFilter, setTimeFilter] = useState<'all' | 'day' | 'month' | 'year'>('day'); // Default to today
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'Credit' | 'Debit'>('all');
  const [specificDate, setSpecificDate] = useState<Date | null>(new Date()); // Today by default

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    saleId?: string;
    invoiceId?: string;
    customerName: string;
    productName: string;
  }>({
    isOpen: false,
    saleId: '',
    invoiceId: '',
    customerName: '',
    productName: ''
  });

  // Edit modal state
  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    sale: Sale | null;
    productId: string;
    customerName: string;
    customerPhone: string;
    quantity: number;
    sellingPrice: number;
    paidAmount: number;
    paymentType: 'Credit' | 'Debit';
  }>({
    isOpen: false,
    sale: null,
    productId: '',
    customerName: '',
    customerPhone: '',
    quantity: 0,
    sellingPrice: 0,
    paidAmount: 0,
    paymentType: 'Credit'
  });

  // Add Sale modal state
  const [isAddSaleModalOpen, setIsAddSaleModalOpen] = useState(false);
  const [saleItems, setSaleItems] = useState<AddSaleItem[]>([createInitialSaleItem()]);
  const [addSaleCustomer, setAddSaleCustomer] = useState('');
  const [addSalePhone, setAddSalePhone] = useState('');
  const [addSalePaidAmount, setAddSalePaidAmount] = useState('');
  const [addSalePaymentType, setAddSalePaymentType] = useState<'Credit' | 'Debit'>('Debit');
  const [addSaleError, setAddSaleError] = useState('');
  const [addSaleDate, setAddSaleDate] = useState<Date>(new Date()); // Date for the sale

  const modalGrandTotal = useMemo(() => {
    return saleItems.reduce((acc, item) => {
      const tot = parseFloat(item.totalAmount);
      if (!isNaN(tot)) return acc + tot;
      const q = parseFloat(item.quantity) || 0;
      const p = parseFloat(item.price) || 0;
      return acc + (q * p);
    }, 0);
  }, [saleItems]);

  const modalGrandQty = useMemo(() => {
    return saleItems.reduce((acc, item) => acc + (parseInt(item.quantity) || 0), 0);
  }, [saleItems]);

  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      const product = products.find(p => p.id === s.productId);
      const matchesSearch = product?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.customerPhone && s.customerPhone.includes(searchTerm));

      const matchesPayment = paymentFilter === 'all' || s.paymentType === paymentFilter;

      if (!matchesSearch || !matchesPayment) return false;

      const saleDate = new Date(s.date);

      // If specific date selected, match that date
      if (specificDate) {
        return saleDate.toDateString() === specificDate.toDateString();
      }

      // Otherwise use time filter
      const now = new Date();

      if (timeFilter === 'day') {
        return saleDate.toDateString() === now.toDateString();
      } else if (timeFilter === 'month') {
        return saleDate.getMonth() === now.getMonth() && saleDate.getFullYear() === now.getFullYear();
      } else if (timeFilter === 'year') {
        return saleDate.getFullYear() === now.getFullYear();
      }
      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sales, products, searchTerm, timeFilter, paymentFilter, specificDate]);

  // Group sales by invoice_id so multi-product purchases for 1 customer appear together
  const groupedSales = useMemo(() => {
    const groups: { [key: string]: {
      key: string;
      invoiceId?: string;
      invoiceNo?: string;
      customerName: string;
      customerPhone?: string;
      date: string;
      totalAmount: number;
      paidAmount: number;
      totalProfit: number;
      items: Array<{
        saleId: string;
        productId: string;
        productName: string;
        companyName?: string;
        quantity: number;
        sellingPrice: number;
        purchasePrice: number;
        totalAmount: number;
        itemProfit: number;
      }>;
    } } = {};

    filteredSales.forEach(s => {
      const key = s.invoiceId || s.id;
      const product = products.find(p => p.id === s.productId);
      const company = product ? companies.find(c => c.id === product.companyId) : undefined;
      const sPaid = s.paidAmount !== undefined && s.paidAmount !== null
        ? s.paidAmount
        : (s.paymentType === 'Debit' ? s.totalAmount : 0);
      const itemProfit = (s.sellingPrice - s.purchasePrice) * s.quantity;

      if (!groups[key]) {
        groups[key] = {
          key,
          invoiceId: s.invoiceId,
          invoiceNo: s.invoiceNo,
          customerName: s.customerName,
          customerPhone: s.customerPhone,
          date: s.date,
          totalAmount: 0,
          paidAmount: 0,
          totalProfit: 0,
          items: []
        };
      }

      groups[key].totalAmount += s.totalAmount;
      groups[key].paidAmount += sPaid;
      groups[key].totalProfit += itemProfit;
      groups[key].items.push({
        saleId: s.id,
        productId: s.productId,
        productName: product?.name || 'Deleted Product',
        companyName: company?.name,
        quantity: s.quantity,
        sellingPrice: s.sellingPrice,
        purchasePrice: s.purchasePrice,
        totalAmount: s.totalAmount,
        itemProfit
      });
    });

    return Object.values(groups).map(g => {
      const left = Math.max(0, g.totalAmount - g.paidAmount);
      return {
        ...g,
        paymentType: left <= 0 ? ('Debit' as const) : ('Credit' as const),
        left
      };
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [filteredSales, products, companies]);

  // Product Summary: Calculate quantity sold per product for the filtered sales
  const productSummary = useMemo(() => {
    const summary: { [productId: string]: { name: string; quantity: number; category: string } } = {};

    filteredSales.forEach(sale => {
      const product = products.find(p => p.id === sale.productId);
      if (product) {
        if (!summary[product.id]) {
          summary[product.id] = {
            name: product.name,
            quantity: 0,
            category: product.category || ''
          };
        }
        summary[product.id].quantity += sale.quantity;
      }
    });

    return Object.values(summary).sort((a, b) => b.quantity - a.quantity);
  }, [filteredSales, products]);

  const totalCredit = filteredSales.reduce((acc, s) => {
    const paid = s.paidAmount !== undefined && s.paidAmount !== null ? s.paidAmount : (s.paymentType === 'Debit' ? s.totalAmount : 0);
    return acc + Math.max(0, s.totalAmount - paid);
  }, 0);
  const totalDebit = filteredSales.reduce((acc, s) => {
    const paid = s.paidAmount !== undefined && s.paidAmount !== null ? s.paidAmount : (s.paymentType === 'Debit' ? s.totalAmount : 0);
    return acc + paid;
  }, 0);

  const exportToExcel = () => {
    const headers = ['Date', 'Customer', 'Phone', 'Product', 'Quantity', 'Rate', 'Total', 'Paid', 'Left', 'Payment Status'];
    const rows = filteredSales.map(s => {
      const p = products.find(prod => prod.id === s.productId);
      const paid = s.paidAmount !== undefined && s.paidAmount !== null ? s.paidAmount : (s.paymentType === 'Debit' ? s.totalAmount : 0);
      const left = Math.max(0, s.totalAmount - paid);
      return [
        new Date(s.date).toLocaleDateString(),
        `"${s.customerName.replace(/"/g, '""')}"`,
        s.customerPhone || 'N/A',
        `"${(p?.name || 'Item').replace(/"/g, '""')}"`,
        s.quantity,
        s.sellingPrice,
        s.totalAmount,
        paid,
        left,
        s.paymentType
      ].join(',');
    });

    const csvContent = "data:text/csv;charset=utf-8," + headers.join(',') + "\n" + rows.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Sales_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleEditSale = (sale: Sale) => {
    const paid = sale.paidAmount !== undefined && sale.paidAmount !== null
      ? sale.paidAmount
      : (sale.paymentType === 'Debit' ? sale.totalAmount : 0);

    setEditModal({
      isOpen: true,
      sale: sale,
      productId: sale.productId,
      customerName: sale.customerName,
      customerPhone: sale.customerPhone || '',
      quantity: sale.quantity,
      sellingPrice: sale.sellingPrice,
      paidAmount: paid,
      paymentType: sale.paymentType
    });
  };

  const handleSaveEdit = async () => {
    if (!editModal.sale) return;

    const total = editModal.quantity * editModal.sellingPrice;
    const paid = editModal.paidAmount;
    const finalPaymentType = paid >= total ? 'Debit' : editModal.paymentType;

    const success = await updateSale(editModal.sale.id, {
      productId: editModal.productId,
      customerName: editModal.customerName,
      customerPhone: editModal.customerPhone,
      quantity: editModal.quantity,
      sellingPrice: editModal.sellingPrice,
      paidAmount: paid,
      paymentType: finalPaymentType
    });

    if (success) {
      setEditModal({
        isOpen: false,
        sale: null,
        productId: '',
        customerName: '',
        customerPhone: '',
        quantity: 0,
        sellingPrice: 0,
        paidAmount: 0,
        paymentType: 'Credit'
      });
    }
  };

  const handleNumChange = (setter: React.Dispatch<React.SetStateAction<string>>, val: string) => {
    if (val.length > 1 && val.startsWith('0') && !val.startsWith('0.')) setter(val.slice(1));
    else setter(val);
  };

  const updateSaleItem = (id: string, updates: Partial<AddSaleItem>) => {
    setSaleItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, ...updates };

      if ('totalAmount' in updates || 'quantity' in updates) {
        const q = parseFloat(updated.quantity) || 0;
        const tot = parseFloat(updated.totalAmount) || 0;
        if (q > 0 && tot > 0) {
          const rate = tot / q;
          updated.price = Number.isInteger(rate) ? rate.toString() : rate.toFixed(2);
        } else if (!updated.totalAmount) {
          updated.price = '0';
        }
      }

      return updated;
    }));
  };

  const addSaleItemRow = () => {
    setSaleItems(prev => [...prev, createInitialSaleItem()]);
  };

  const removeSaleItemRow = (id: string) => {
    if (saleItems.length <= 1) return;
    setSaleItems(prev => prev.filter(item => item.id !== id));
  };

  // Paid Amount Change Handler: Updates Paid & Left, and auto-marks as Debit/Credit
  const handlePaidAmountChange = (newPaidStr: string) => {
    handleNumChange(setAddSalePaidAmount, newPaidStr);
    const paid = parseFloat(newPaidStr) || 0;
    const left = modalGrandTotal - paid;

    if (left <= 0 && modalGrandTotal > 0) {
      setAddSalePaymentType('Debit');
    } else {
      setAddSalePaymentType('Credit');
    }
  };

  const handleAddSaleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!addSaleCustomer.trim()) {
      setAddSaleError('Please enter customer name');
      return;
    }

    if (addSalePhone.trim() && !/^\d{11}$/.test(addSalePhone.trim())) {
      setAddSaleError('Phone number must be exactly 11 digits (e.g. 03001234567)');
      return;
    }

    if (saleItems.length === 0) {
      setAddSaleError('Please add at least one product');
      return;
    }

    // Validate each item
    for (let i = 0; i < saleItems.length; i++) {
      const item = saleItems[i];
      if (!item.productId) {
        setAddSaleError(`Please select a product for Item #${i + 1}`);
        return;
      }
      const q = parseInt(item.quantity);
      if (!q || q <= 0) {
        setAddSaleError(`Quantity for Item #${i + 1} must be greater than 0`);
        return;
      }
      const stock = stocks.find(s => s.productId === item.productId);
      const available = stock?.remaining || 0;
      if (q > available) {
        const prod = products.find(p => p.id === item.productId);
        setAddSaleError(`Insufficient stock for "${prod?.name || 'Product'}". Available: ${available}, requested: ${q}`);
        return;
      }
    }

    const rawPaid = parseFloat(addSalePaidAmount);
    const effectivePaid = !isNaN(rawPaid) ? rawPaid : (addSalePaymentType === 'Debit' ? modalGrandTotal : 0);
    const left = Math.max(0, modalGrandTotal - effectivePaid);
    const finalPaymentType = left <= 0 ? 'Debit' : addSalePaymentType;

    const itemsPayload = saleItems.map(item => {
      const q = parseInt(item.quantity);
      let p = parseFloat(item.price);
      const tot = parseFloat(item.totalAmount);
      if ((!p || p <= 0) && tot && q > 0) p = tot / q;
      return {
        productId: item.productId,
        quantity: q,
        sellingPrice: p || 0
      };
    });

    const success = await addBulkSale(
      addSaleCustomer.trim(),
      itemsPayload,
      finalPaymentType,
      addSalePhone.trim(),
      addSaleDate,
      effectivePaid
    );

    if (success) {
      setIsAddSaleModalOpen(false);
      setSaleItems([createInitialSaleItem()]);
      setAddSaleCustomer('');
      setAddSalePhone('');
      setAddSalePaidAmount('');
      setAddSaleError('');
      setAddSalePaymentType('Debit');
    }
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Ledger Records</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Detailed transaction logs and filter options</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              setSaleItems([createInitialSaleItem()]);
              setAddSaleCustomer('');
              setAddSalePhone('');
              setAddSalePaidAmount('');
              setAddSaleError('');
              setAddSalePaymentType('Debit');
              setAddSaleDate(specificDate || new Date());
              setIsAddSaleModalOpen(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl flex items-center gap-3 font-bold shadow-xl shadow-blue-600/20 active:scale-95 transition-all"
          >
            <Plus className="w-5 h-5 stroke-[3px]" />
            ADD SALE
          </button>
          <button
            onClick={exportToExcel}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-2xl flex items-center gap-3 font-bold shadow-xl shadow-emerald-600/20 active:scale-95 transition-all"
          >
            <Download className="w-5 h-5" />
            EXPORT CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-800/20 p-6 rounded-3xl flex justify-between items-center group transition-all hover:shadow-lg">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-rose-600">Total Credit (Pending)</p>
            <h3 className="text-3xl font-black text-rose-700 dark:text-rose-400">Rs. {totalCredit.toLocaleString()}</h3>
          </div>
          <CreditCard className="w-10 h-10 text-rose-300 group-hover:scale-110 transition-transform" />
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/20 p-6 rounded-3xl flex justify-between items-center group transition-all hover:shadow-lg">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Total Debit (Paid)</p>
            <h3 className="text-3xl font-black text-emerald-700 dark:text-emerald-400">Rs. {totalDebit.toLocaleString()}</h3>
          </div>
          <Wallet className="w-10 h-10 text-emerald-300 group-hover:scale-110 transition-transform" />
        </div>
      </div>

      {/* Product Summary Bar - Shows products sold today */}
      {productSummary.length > 0 && (
        <div className="bg-gradient-to-r from-emerald-50 to-blue-50 dark:from-emerald-900/20 dark:to-blue-900/20 rounded-3xl p-6 border border-emerald-200 dark:border-emerald-800/30">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Products Sold {specificDate ? `on ${specificDate.toLocaleDateString()}` : 'Today'}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">Quick calculation summary</p>
            </div>
            <ShoppingCart className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {productSummary.map((item, idx) => (
              <div
                key={idx}
                className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 hover:shadow-lg transition-shadow"
              >
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 truncate" title={item.name}>
                  {item.name}
                </p>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                  {item.quantity}
                </p>
                <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase mt-1">
                  {item.category || 'Units'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200/60 dark:border-slate-700 space-y-5">
        <div className="flex flex-col xl:flex-row gap-6">
          <div className="relative flex-1">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Filter by customer, phone or product..."
              className="w-full pl-14 pr-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-none outline-none font-bold text-slate-900 dark:text-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl">
              <button onClick={() => setPaymentFilter('all')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${paymentFilter === 'all' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-400'}`}>All</button>
              <button onClick={() => setPaymentFilter('Debit')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${paymentFilter === 'Debit' ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' : 'text-slate-400'}`}>Paid Only</button>
              <button onClick={() => setPaymentFilter('Credit')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${paymentFilter === 'Credit' ? 'bg-white dark:bg-slate-700 text-rose-600 shadow-sm' : 'text-slate-400'}`}>Pending Only</button>
            </div>

            {/* Date Filter with Quick Navigation */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Quick Day Buttons */}
              <div className="flex bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl gap-1">
                <button
                  onClick={() => {
                    setSpecificDate(new Date());
                    setTimeFilter('day');
                  }}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${specificDate && specificDate.toDateString() === new Date().toDateString()
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-emerald-600'
                    }`}
                >
                  📅 Today
                </button>
                <button
                  onClick={() => {
                    const yesterday = new Date();
                    yesterday.setDate(yesterday.getDate() - 1);
                    setSpecificDate(yesterday);
                    setTimeFilter('day');
                  }}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${specificDate && specificDate.toDateString() === new Date(new Date().setDate(new Date().getDate() - 1)).toDateString()
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-blue-600'
                    }`}
                >
                  ⏮️ Yesterday
                </button>
                <button
                  onClick={() => {
                    setTimeFilter('all');
                    setSpecificDate(null);
                  }}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${timeFilter === 'all' && !specificDate ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-600' : 'text-slate-400'
                    }`}
                >
                  All Time
                </button>
              </div>

              {/* Custom Date Picker */}
              <div className="w-48">
                <CustomDatePicker
                  selected={specificDate}
                  onChange={(date) => {
                    setSpecificDate(date);
                    if (date) setTimeFilter('day');
                  }}
                  placeholderText="Pick a date..."
                  maxDate={new Date()}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-6 shadow-sm border border-slate-200/60 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-[10px] uppercase text-slate-400 font-black tracking-widest border-b border-slate-100 dark:border-slate-700">
              <tr>
                <th className="px-8 py-6">Customer Details</th>
                <th className="px-8 py-6">Product Item</th>
                <th className="px-8 py-6 text-center">Volume</th>
                <th className="px-8 py-6 text-center">Payment Status</th>
                <th className="px-8 py-6 text-right">Total Invoice</th>
                <th className="px-8 py-6 text-right text-emerald-500">Profit</th>
                <th className="px-8 py-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {groupedSales.map((group) => {
                const isMultiItem = group.items.length > 1;
                const totalQty = group.items.reduce((sum, item) => sum + item.quantity, 0);
                const firstSale = sales.find(s => s.id === group.items[0].saleId);

                return (
                  <tr key={group.key} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                    <td className="px-8 py-6">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900 dark:text-white">
                            {group.customerName}
                          </span>
                          {isMultiItem && (
                            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                              {group.items.length} Products
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[10px] font-bold text-slate-400">
                          <span className="uppercase">{new Date(group.date).toLocaleDateString()}</span>
                          {group.customerPhone && (
                            <span className="flex items-center gap-1 text-blue-500">
                              <Phone className="w-2.5 h-2.5" /> {group.customerPhone}
                            </span>
                          )}
                          {group.invoiceNo && (
                            <span className="text-slate-400 font-mono">
                              #{group.invoiceNo}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      {group.items.length === 1 ? (
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white text-base leading-tight">
                            {group.items[0].productName}
                          </p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">
                            Rs. {group.items[0].sellingPrice.toLocaleString()}/ea
                            {group.items[0].companyName ? ` • ${group.items[0].companyName}` : ''}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-w-sm">
                          {group.items.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs py-0.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
                              <span className="font-bold text-slate-800 dark:text-slate-200 truncate mr-2" title={item.productName}>
                                • {item.productName}
                              </span>
                              <span className="text-[10px] text-slate-400 font-bold whitespace-nowrap">
                                {item.quantity} pk × Rs. {item.sellingPrice.toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-8 py-6 text-center text-slate-600 dark:text-slate-400 font-bold">
                      {totalQty}
                      {isMultiItem && (
                        <p className="text-[9px] text-slate-400 uppercase font-semibold">({group.items.length} items)</p>
                      )}
                    </td>
                    <td className="px-8 py-6 text-center">
                      <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${group.paymentType === 'Debit' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'}`}>
                        {group.paymentType === 'Debit' ? 'Paid (Debit)' : 'Credit (Pending)'}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="font-black text-slate-900 dark:text-white text-base">
                        Rs. {group.totalAmount.toLocaleString()}
                      </div>
                      <div className="flex flex-col items-end gap-0.5 mt-1 text-[11px] font-bold">
                        <span className="text-emerald-600 dark:text-emerald-400">Paid: Rs. {group.paidAmount.toLocaleString()}</span>
                        {group.left > 0 ? (
                          <span className="text-rose-600 dark:text-rose-400 font-extrabold">Left: Rs. {group.left.toLocaleString()}</span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 font-medium">✓ Cleared</span>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <span className={`font-black text-sm ${group.totalProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {group.totalProfit >= 0 ? '+' : ''}Rs. {Math.abs(group.totalProfit).toLocaleString()}
                      </span>
                      {group.items.length > 1 && (
                        <p className="text-[9px] text-slate-400 font-bold mt-0.5 uppercase">{group.items.length} items</p>
                      )}
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!isMultiItem && firstSale && (
                          <button
                            onClick={() => handleEditSale(firstSale)}
                            className="p-2 text-slate-400 hover:text-blue-500 transition-colors bg-slate-50 dark:bg-slate-800 rounded-lg"
                            title="Edit Sale"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setConfirmDialog({
                              isOpen: true,
                              invoiceId: group.invoiceId,
                              saleId: !group.invoiceId ? group.items[0].saleId : undefined,
                              customerName: group.customerName,
                              productName: isMultiItem ? `${group.items.length} products` : group.items[0].productName
                            });
                          }}
                          className="p-2 text-slate-400 hover:text-rose-500 transition-colors bg-slate-50 dark:bg-slate-800 rounded-lg"
                          title={isMultiItem ? "Delete Entire Invoice" : "Delete Sale"}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredSales.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-24 text-center text-slate-400">
                    <ShoppingCart className="w-16 h-16 mx-auto mb-4 opacity-10" />
                    <p className="text-lg font-bold">No transactions found.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Sale Modal */}
      {isAddSaleModalOpen && (() => {
        const currentTotal = modalGrandTotal;
        const currentPaid = parseFloat(addSalePaidAmount) || 0;
        const currentLeft = Math.max(0, currentTotal - currentPaid);

        return (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-800 w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-[2.5rem] shadow-2xl border border-white/20">
              <div className="bg-blue-600 p-8 text-white flex justify-between items-center sticky top-0 z-20">
                <div>
                  <h2 className="text-2xl font-black">Add New Sale</h2>
                  <p className="text-xs text-blue-100 font-medium mt-1">Add one or multiple products for a customer invoice</p>
                </div>
                <button onClick={() => setIsAddSaleModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddSaleSubmit} className="p-8 space-y-6">
                {addSaleError && (
                  <div className="p-4 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-2xl font-bold text-xs uppercase tracking-tight border border-rose-200 dark:border-rose-900/30">
                    {addSaleError}
                  </div>
                )}

                {/* Customer Details Section */}
                <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 space-y-4">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-600" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">Customer & Invoice Details</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Customer Name *</label>
                      <input
                        type="text"
                        value={addSaleCustomer}
                        onChange={(e) => setAddSaleCustomer(e.target.value)}
                        className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 outline-none font-bold text-slate-900 dark:text-white"
                        placeholder="Enter customer name"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Phone Number (11 Digits)</label>
                      <input
                        type="tel"
                        maxLength={11}
                        value={addSalePhone}
                        onChange={(e) => setAddSalePhone(e.target.value.replace(/\D/g, ''))}
                        className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 outline-none font-bold text-slate-900 dark:text-white"
                        placeholder="e.g. 03001234567"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Sale Date *</label>
                    <CustomDatePicker
                      selected={addSaleDate}
                      onChange={(date) => setAddSaleDate(date || new Date())}
                      placeholderText="Select sale date..."
                      maxDate={new Date()}
                    />
                  </div>
                </div>

                {/* Items Purchased Section */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4 text-emerald-600" />
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Purchased Products ({saleItems.length})
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={addSaleItemRow}
                      className="flex items-center gap-1.5 text-xs font-black text-blue-600 dark:text-blue-400 hover:text-blue-700 bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-xl border border-blue-200 dark:border-blue-800 transition-all hover:scale-105 active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Another Product
                    </button>
                  </div>

                  {/* List of Product Items */}
                  <div className="space-y-4">
                    {saleItems.map((item, idx) => {
                      const itemFilteredProducts = products
                        .filter(p => {
                          const matchesCompany = item.companyId === 'all' || p.companyId === item.companyId;
                          const sLower = item.search.trim().toLowerCase();
                          const matchesSearch = !sLower || p.name.toLowerCase().includes(sLower) || (p.category && p.category.toLowerCase().includes(sLower));
                          return matchesCompany && matchesSearch;
                        })
                        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

                      const selectedProd = products.find(p => p.id === item.productId);
                      const selectedStock = stocks.find(s => s.productId === item.productId);
                      const available = selectedStock?.remaining || 0;
                      const lineTotal = parseFloat(item.totalAmount) || ((parseFloat(item.quantity) || 0) * (parseFloat(item.price) || 0));

                      return (
                        <div key={item.id} className="bg-slate-50 dark:bg-slate-900/60 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 space-y-4 relative">
                          <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
                            <span className="text-xs font-black uppercase tracking-widest text-slate-500">
                              Item #{idx + 1}
                            </span>
                            {saleItems.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeSaleItemRow(item.id)}
                                className="text-rose-500 hover:text-rose-700 p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors flex items-center gap-1 text-[11px] font-bold"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Remove Item
                              </button>
                            )}
                          </div>

                          {/* Company Filter & Product Search */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Company Filter</label>
                              <select
                                value={item.companyId}
                                onChange={(e) => updateSaleItem(item.id, { companyId: e.target.value })}
                                className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500"
                              >
                                <option value="all">🏢 All Companies</option>
                                {companies.map(c => (
                                  <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                              </select>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Quick Search</label>
                              <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                <input
                                  type="text"
                                  placeholder="Type product name..."
                                  value={item.search}
                                  onChange={(e) => updateSaleItem(item.id, { search: e.target.value })}
                                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Product Select Dropdown */}
                          <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Select Product *</label>
                            <select
                              value={item.productId}
                              onChange={(e) => updateSaleItem(item.id, { productId: e.target.value })}
                              className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 outline-none font-bold text-sm text-slate-900 dark:text-white"
                              required
                            >
                              <option value="">Choose product...</option>
                              {itemFilteredProducts.map(p => {
                                const st = stocks.find(s => s.productId === p.id);
                                const comp = companies.find(c => c.id === p.companyId);
                                return (
                                  <option key={p.id} value={p.id}>
                                    {p.name} {comp ? `(${comp.name})` : ''} - [{st?.remaining || 0} in stock]
                                  </option>
                                );
                              })}
                            </select>
                          </div>

                          {/* Stock Badge if selected */}
                          {selectedProd && (
                            <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-between border border-blue-100 dark:border-blue-900/30">
                              <span className="text-xs font-bold text-blue-900 dark:text-blue-200">
                                📦 {selectedProd.name}
                              </span>
                              <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${
                                available > (selectedProd.minStock || 5)
                                  ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300'
                              }`}>
                                {available} {selectedProd.unit || 'Units'} Available
                              </span>
                            </div>
                          )}

                          {/* Quantity and Total Amount Charged */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Quantity *</label>
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => updateSaleItem(item.id, { quantity: e.target.value })}
                                className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500"
                                required
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Charged (Rs.) *</label>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={item.totalAmount}
                                onChange={(e) => updateSaleItem(item.id, { totalAmount: e.target.value })}
                                className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-blue-600 dark:text-blue-400 outline-none focus:border-blue-500"
                                placeholder="e.g. 50000"
                                required
                              />
                            </div>
                          </div>

                          {/* Unit rate badge & Line Total preview */}
                          <div className="flex justify-between items-center text-xs px-1">
                            <span className="text-slate-400 font-medium">
                              Rate: <span className="font-bold text-slate-700 dark:text-slate-300">Rs. {item.price || '0'}</span> / {selectedProd?.unit || 'pack'}
                            </span>
                            <span className="font-black text-emerald-600 dark:text-emerald-400">
                              Line Total: Rs. {lineTotal.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Add Product Button */}
                  <button
                    type="button"
                    onClick={addSaleItemRow}
                    className="w-full py-4 border-2 border-dashed border-blue-300 dark:border-blue-700/60 rounded-3xl text-blue-600 dark:text-blue-400 font-black text-sm flex items-center justify-center gap-2 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-all active:scale-98"
                  >
                    <Plus className="w-4 h-4" />
                    + Add Another Product to this Sale
                  </button>
                </div>

                {/* Overall Invoice Payment Section */}
                <div className="bg-slate-50 dark:bg-slate-900/70 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black uppercase tracking-widest text-slate-400">Grand Total Invoice:</span>
                    <span className="text-2xl font-black text-slate-900 dark:text-white">
                      Rs. {currentTotal.toLocaleString()}
                      <span className="text-xs text-slate-400 font-bold ml-2">({modalGrandQty} items)</span>
                    </span>
                  </div>

                  {/* Amount Paid by customer */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                        Amount Paid by Customer (Rs.) *
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setAddSalePaidAmount(currentTotal.toString());
                          setAddSalePaymentType('Debit');
                        }}
                        className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Set Full Payment
                      </button>
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={addSalePaidAmount}
                      onChange={(e) => handlePaidAmountChange(e.target.value)}
                      className="w-full px-5 py-3 rounded-2xl bg-white dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 outline-none font-black text-emerald-600 text-xl"
                      placeholder="Enter amount paid"
                      required
                    />
                  </div>

                  {/* Visual Progress Bar */}
                  <div className="space-y-2 pt-1">
                    <div className="flex justify-between items-center text-xs font-black uppercase tracking-wider">
                      <span className="text-slate-400">Payment Status:</span>
                      <span className={currentLeft === 0 && currentTotal > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>
                        {currentLeft === 0 && currentTotal > 0 ? "✅ Fully Paid (0 Left)" : `⚠️ Credit / Left: Rs. ${currentLeft.toLocaleString()}`}
                      </span>
                    </div>

                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-3 rounded-full overflow-hidden flex">
                      <div
                        className="bg-emerald-500 h-full transition-all duration-300"
                        style={{ width: `${currentTotal > 0 ? Math.min(100, (currentPaid / currentTotal) * 100) : 0}%` }}
                        title={`Paid: Rs. ${currentPaid}`}
                      />
                      <div
                        className="bg-rose-500 h-full transition-all duration-300"
                        style={{ width: `${currentTotal > 0 ? Math.max(0, (currentLeft / currentTotal) * 100) : 0}%` }}
                        title={`Left: Rs. ${currentLeft}`}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center pt-2">
                      <div className="p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Total Bill</p>
                        <p className="text-sm font-black text-slate-800 dark:text-white">Rs. {currentTotal.toLocaleString()}</p>
                      </div>
                      <div className="p-3 bg-white dark:bg-slate-800 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase">Paid</p>
                        <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">Rs. {currentPaid.toLocaleString()}</p>
                      </div>
                      <div className={`p-3 bg-white dark:bg-slate-800 rounded-2xl border ${currentLeft > 0 ? 'border-rose-200 dark:border-rose-900/30' : 'border-slate-100 dark:border-slate-700'}`}>
                        <p className={`text-[10px] font-bold uppercase ${currentLeft > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>Left</p>
                        <p className={`text-sm font-black ${currentLeft > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>Rs. {currentLeft.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>

                  {/* Payment Type Selection */}
                  <div className="flex bg-slate-200 dark:bg-slate-900 p-1 rounded-2xl">
                    <button
                      type="button"
                      onClick={() => setAddSalePaymentType('Debit')}
                      className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${addSalePaymentType === 'Debit' ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' : 'text-slate-400'}`}
                    >
                      Debit (Paid)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddSalePaymentType('Credit')}
                      className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${addSalePaymentType === 'Credit' ? 'bg-white dark:bg-slate-700 text-rose-600 shadow-sm' : 'text-slate-400'}`}
                    >
                      Credit (Pending)
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className={`w-full ${addSalePaymentType === 'Debit' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'} text-white font-black py-5 rounded-2xl shadow-xl uppercase tracking-widest text-sm active:scale-95 transition-all`}
                >
                  Finalize Sale ({saleItems.length} Product{saleItems.length !== 1 ? 's' : ''})
                </button>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Edit Sale Modal */}
      {editModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">Edit Sale Record</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Update sale details and save changes</p>
            </div>

            <div className="p-8 space-y-6">
              {/* Product Selection */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Product</label>
                <select
                  value={editModal.productId}
                  onChange={(e) => setEditModal({ ...editModal, productId: e.target.value })}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-emerald-500 outline-none font-bold text-slate-900 dark:text-white"
                >
                  {products.map(product => (
                    <option key={product.id} value={product.id}>
                      {product.name} - {product.category}
                    </option>
                  ))}
                </select>
              </div>

              {/* Customer Name */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Customer Name</label>
                <input
                  type="text"
                  value={editModal.customerName}
                  onChange={(e) => setEditModal({ ...editModal, customerName: e.target.value })}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-emerald-500 outline-none font-bold text-slate-900 dark:text-white"
                  placeholder="Enter customer name"
                />
              </div>

              {/* Customer Phone */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Customer Phone (Optional)</label>
                <input
                  type="tel"
                  value={editModal.customerPhone}
                  onChange={(e) => setEditModal({ ...editModal, customerPhone: e.target.value })}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-emerald-500 outline-none font-bold text-slate-900 dark:text-white"
                  placeholder="03001234567"
                  maxLength={11}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Quantity */}
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Quantity</label>
                  <input
                    type="number"
                    value={editModal.quantity}
                    onChange={(e) => setEditModal({ ...editModal, quantity: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-emerald-500 outline-none font-bold text-slate-900 dark:text-white"
                    min="1"
                  />
                </div>

                {/* Selling Price */}
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Selling Price (Rs.)</label>
                  <input
                    type="number"
                    value={editModal.sellingPrice}
                    onChange={(e) => setEditModal({ ...editModal, sellingPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-emerald-500 outline-none font-bold text-slate-900 dark:text-white"
                    step="0.01"
                    min="0"
                  />
                </div>
              </div>

              {/* Paid Amount */}
              {(() => {
                const total = editModal.quantity * editModal.sellingPrice;
                const paid = editModal.paidAmount;
                const left = Math.max(0, total - paid);
                return (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Amount Paid (Rs.)</label>
                        <button
                          type="button"
                          onClick={() => setEditModal({ ...editModal, paidAmount: total, paymentType: 'Debit' })}
                          className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Set Full Payment
                        </button>
                      </div>
                      <input
                        type="number"
                        value={editModal.paidAmount}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setEditModal({
                            ...editModal,
                            paidAmount: val,
                            paymentType: val >= total ? 'Debit' : 'Credit'
                          });
                        }}
                        className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-emerald-500 outline-none font-bold text-emerald-600 text-base"
                        min="0"
                        step="any"
                      />
                    </div>

                    {/* Payment Type Buttons */}
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Payment Status</label>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => setEditModal({ ...editModal, paymentType: 'Debit' })}
                          className={`flex-1 py-3 px-6 rounded-2xl font-black uppercase text-xs transition-all ${editModal.paymentType === 'Debit'
                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                            : 'bg-slate-100 dark:bg-slate-900 text-slate-400 hover:text-emerald-600'
                            }`}
                        >
                          ✓ Paid (Debit)
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditModal({ ...editModal, paymentType: 'Credit' })}
                          className={`flex-1 py-3 px-6 rounded-2xl font-black uppercase text-xs transition-all ${editModal.paymentType === 'Credit'
                            ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
                            : 'bg-slate-100 dark:bg-slate-900 text-slate-400 hover:text-rose-600'
                            }`}
                        >
                          ⏱ Pending (Credit)
                        </button>
                      </div>
                    </div>

                    {/* Summary */}
                    <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-4 border-2 border-slate-200 dark:border-slate-700 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-black uppercase tracking-widest text-slate-400">Total Invoice:</span>
                        <span className="text-xl font-black text-slate-900 dark:text-white">Rs. {total.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className="text-emerald-600 dark:text-emerald-400">Paid: Rs. {paid.toLocaleString()}</span>
                        <span className={left > 0 ? "text-rose-600 dark:text-rose-400 font-extrabold" : "text-slate-400"}>
                          {left > 0 ? `Left: Rs. ${left.toLocaleString()}` : '0 Left (Fully Paid)'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="p-8 border-t border-slate-200 dark:border-slate-700 flex gap-4">
              <button
                onClick={() => setEditModal({ ...editModal, isOpen: false })}
                className="flex-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-black py-4 rounded-2xl uppercase tracking-widest hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-2xl uppercase tracking-widest shadow-xl shadow-emerald-600/30 transition-all active:scale-95"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title="Remove Sale Record"
        message={`Are you sure you want to remove the sale of "${confirmDialog.productName}" to "${confirmDialog.customerName}"? This will adjust the inventory accordingly.`}
        confirmText="Yes, Remove"
        cancelText="Cancel"
        onConfirm={() => {
          if (confirmDialog.invoiceId) {
            deleteInvoice(confirmDialog.invoiceId);
          } else if (confirmDialog.saleId) {
            deleteSale(confirmDialog.saleId);
          }
          setConfirmDialog({ isOpen: false, saleId: '', invoiceId: '', customerName: '', productName: '' });
        }}
        onCancel={() => setConfirmDialog({ isOpen: false, saleId: '', invoiceId: '', customerName: '', productName: '' })}
        isDangerous={true}
      />
    </div>
  );
};

export default SalesPage;
