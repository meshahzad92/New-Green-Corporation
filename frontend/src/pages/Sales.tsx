
import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Sale } from '../types';
import { ShoppingCart, Search, Calendar, Filter, User, Wallet, CreditCard, Download, Phone, Trash2, Pencil, Plus, X } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import CustomDatePicker from '../components/CustomDatePicker';

const SalesPage: React.FC = () => {
  const { companies, products, sales, stocks, deleteSale, updateSale, addSale } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [timeFilter, setTimeFilter] = useState<'all' | 'day' | 'month' | 'year'>('day'); // Default to today
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'Credit' | 'Debit'>('all');
  const [specificDate, setSpecificDate] = useState<Date | null>(new Date()); // Today by default

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    saleId: '',
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
  const [addSaleCompanyId, setAddSaleCompanyId] = useState<string>('all');
  const [addSaleProductSearch, setAddSaleProductSearch] = useState('');
  const [addSaleProductId, setAddSaleProductId] = useState('');
  const [addSaleQty, setAddSaleQty] = useState('1');
  const [addSaleCustomer, setAddSaleCustomer] = useState('');
  const [addSalePhone, setAddSalePhone] = useState('');
  const [addSaleTotalAmount, setAddSaleTotalAmount] = useState('');
  const [addSalePrice, setAddSalePrice] = useState('0');
  const [addSalePaidAmount, setAddSalePaidAmount] = useState('');
  const [addSalePaymentType, setAddSalePaymentType] = useState<'Credit' | 'Debit'>('Debit');
  const [addSaleError, setAddSaleError] = useState('');
  const [addSaleDate, setAddSaleDate] = useState<Date>(new Date()); // Date for the sale

  // Filter products for the Add Sale modal based on selected company and search text
  const modalProducts = useMemo(() => {
    return products
      .filter(p => {
        const matchesCompany = addSaleCompanyId === 'all' || p.companyId === addSaleCompanyId;
        const searchLower = addSaleProductSearch.trim().toLowerCase();
        const matchesSearch = !searchLower || 
          p.name.toLowerCase().includes(searchLower) ||
          (p.category && p.category.toLowerCase().includes(searchLower));
        return matchesCompany && matchesSearch;
      })
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }, [products, addSaleCompanyId, addSaleProductSearch]);

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

  // Quantity Change Handler: Recalculates rate if total amount is present
  const handleQuantityChange = (newQtyStr: string) => {
    handleNumChange(setAddSaleQty, newQtyStr);
    const q = parseFloat(newQtyStr) || 0;
    const tot = parseFloat(addSaleTotalAmount) || 0;
    if (q > 0 && tot > 0) {
      const rate = tot / q;
      setAddSalePrice(Number.isInteger(rate) ? rate.toString() : rate.toFixed(2));
    }
  };

  // Total Amount Charged Handler (Primary requirement: total / quantity = unit price)
  const handleTotalAmountChange = (newTotalStr: string) => {
    handleNumChange(setAddSaleTotalAmount, newTotalStr);
    const tot = parseFloat(newTotalStr) || 0;
    const q = parseFloat(addSaleQty) || 1;
    if (q > 0) {
      const rate = tot / q;
      setAddSalePrice(rate > 0 ? (Number.isInteger(rate) ? rate.toString() : rate.toFixed(2)) : '0');
    }
    // Auto-sync Paid Amount by default if not set or fully paid
    setAddSalePaidAmount(newTotalStr);
    setAddSalePaymentType('Debit'); // If 0 left, automatically mark as Paid (Debit)
  };

  // Unit Rate (price per pack) Handler
  const handleRateChange = (newRateStr: string) => {
    handleNumChange(setAddSalePrice, newRateStr);
    const rate = parseFloat(newRateStr) || 0;
    const q = parseFloat(addSaleQty) || 1;
    const tot = rate * q;
    const formattedTot = Number.isInteger(tot) ? tot.toString() : tot.toFixed(2);
    setAddSaleTotalAmount(formattedTot);
    setAddSalePaidAmount(formattedTot);
    setAddSalePaymentType('Debit');
  };

  // Paid Amount Change Handler: Updates Paid & Left, and auto-marks as Debit/Credit
  const handlePaidAmountChange = (newPaidStr: string) => {
    handleNumChange(setAddSalePaidAmount, newPaidStr);
    const paid = parseFloat(newPaidStr) || 0;
    const tot = parseFloat(addSaleTotalAmount) || ((parseFloat(addSaleQty) || 0) * (parseFloat(addSalePrice) || 0)) || 0;
    const left = tot - paid;

    if (left <= 0 && tot > 0) {
      setAddSalePaymentType('Debit'); // Automatically marked as Paid when 0 left
    } else {
      setAddSalePaymentType('Credit'); // Automatically marked as Credit when amount left
    }
  };

  const handleAddSaleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = parseInt(addSaleQty);
    let p = parseFloat(addSalePrice);
    const tot = parseFloat(addSaleTotalAmount);

    if ((!p || p <= 0) && tot && q > 0) {
      p = tot / q;
    }

    // Validation
    if (!q || q <= 0 || !addSaleCustomer.trim() || !addSaleProductId) {
      setAddSaleError('Please fill all required fields (Product, Customer, Quantity)');
      return;
    }

    if (addSalePhone.trim() && !/^\d{11}$/.test(addSalePhone.trim())) {
      setAddSaleError('Phone number must be exactly 11 digits (e.g. 03001234567)');
      return;
    }

    // Check stock availability
    const stock = stocks.find(s => s.productId === addSaleProductId);
    if (q > (stock?.remaining || 0)) {
      setAddSaleError(`Insufficient Stock! Available: ${stock?.remaining || 0}`);
      return;
    }

    // If 0 left, ensure marked as Debit (Paid)
    const rawPaid = parseFloat(addSalePaidAmount);
    const effectiveTotal = tot || (q * p);
    const effectivePaid = !isNaN(rawPaid) ? rawPaid : (addSalePaymentType === 'Debit' ? effectiveTotal : 0);
    const left = Math.max(0, effectiveTotal - effectivePaid);
    const finalPaymentType = left <= 0 ? 'Debit' : addSalePaymentType;

    const success = await addSale(
      addSaleProductId,
      q,
      addSaleCustomer,
      p,
      finalPaymentType,
      addSalePhone.trim(),
      addSaleDate,
      effectivePaid
    );
    if (success) {
      setIsAddSaleModalOpen(false);
      setAddSaleCompanyId('all');
      setAddSaleProductSearch('');
      setAddSaleProductId('');
      setAddSaleQty('1');
      setAddSaleCustomer('');
      setAddSalePhone('');
      setAddSaleTotalAmount('');
      setAddSalePrice('0');
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
              setAddSaleCompanyId('all');
              setAddSaleProductSearch('');
              setAddSaleProductId('');
              setAddSaleQty('1');
              setAddSaleCustomer('');
              setAddSalePhone('');
              setAddSaleTotalAmount('');
              setAddSalePrice('0');
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
                <th className="px-8 py-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {filteredSales.map((sale) => {
                const product = products.find(p => p.id === sale.productId);
                return (
                  <tr key={sale.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                    <td className="px-8 py-6">
                      <div className="flex flex-col">
                        <span className="font-black text-slate-900 dark:text-white flex items-center gap-2">
                          {sale.customerName}
                        </span>
                        <div className="flex items-center gap-3 mt-1 text-[10px] font-bold text-slate-400">
                          <span className="uppercase">{new Date(sale.date).toLocaleDateString()}</span>
                          {sale.customerPhone && <span className="flex items-center gap-1 text-blue-500"><Phone className="w-2.5 h-2.5" /> {sale.customerPhone}</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <p className="font-bold text-slate-900 dark:text-white text-base leading-tight">{product?.name || 'Deleted Product'}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Rs. {sale.sellingPrice.toLocaleString()}/ea</p>
                    </td>
                    <td className="px-8 py-6 text-center text-slate-600 dark:text-slate-400 font-bold">
                      {sale.quantity}
                    </td>
                    <td className="px-8 py-6 text-center">
                      <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${sale.paymentType === 'Debit' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'}`}>
                        {sale.paymentType === 'Debit' ? 'Paid (Debit)' : 'Credit (Pending)'}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="font-black text-slate-900 dark:text-white text-base">
                        Rs. {sale.totalAmount.toLocaleString()}
                      </div>
                      {(() => {
                        const paid = sale.paidAmount !== undefined && sale.paidAmount !== null
                          ? sale.paidAmount
                          : (sale.paymentType === 'Debit' ? sale.totalAmount : 0);
                        const left = Math.max(0, sale.totalAmount - paid);
                        return (
                          <div className="flex flex-col items-end gap-0.5 mt-1 text-[11px] font-bold">
                            <span className="text-emerald-600 dark:text-emerald-400">Paid: Rs. {paid.toLocaleString()}</span>
                            {left > 0 ? (
                              <span className="text-rose-600 dark:text-rose-400 font-extrabold">Left: Rs. {left.toLocaleString()}</span>
                            ) : (
                              <span className="text-slate-400 dark:text-slate-500 font-medium">✓ Cleared</span>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEditSale(sale)}
                          className="p-2 text-slate-400 hover:text-blue-500 transition-colors bg-slate-50 dark:bg-slate-800 rounded-lg"
                          title="Edit Sale"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            const product = products.find(p => p.id === sale.productId);
                            setConfirmDialog({
                              isOpen: true,
                              saleId: sale.id,
                              customerName: sale.customerName,
                              productName: product?.name || 'Unknown'
                            });
                          }}
                          className="p-2 text-slate-400 hover:text-rose-500 transition-colors bg-slate-50 dark:bg-slate-800 rounded-lg"
                          title="Delete Sale"
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
        const currentTotal = parseFloat(addSaleTotalAmount) || ((parseFloat(addSaleQty) || 0) * (parseFloat(addSalePrice) || 0)) || 0;
        const currentPaid = parseFloat(addSalePaidAmount) || 0;
        const currentLeft = Math.max(0, currentTotal - currentPaid);
        const selectedProductObj = products.find(p => p.id === addSaleProductId);
        const selectedProductStock = stocks.find(s => s.productId === addSaleProductId);
        const stockRemaining = selectedProductStock?.remaining || 0;

        return (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-800 w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-[2.5rem] shadow-2xl border border-white/20">
              <div className="bg-blue-600 p-8 text-white flex justify-between items-center sticky top-0 z-10">
                <div>
                  <h2 className="text-2xl font-black">Add New Sale</h2>
                  <p className="text-xs text-blue-100 font-medium mt-1">Select company, search product, and log transaction</p>
                </div>
                <button onClick={() => setIsAddSaleModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddSaleSubmit} className="p-8 space-y-5">
                {addSaleError && (
                  <div className="p-4 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-2xl font-bold text-xs uppercase tracking-tight border border-rose-200 dark:border-rose-900/30">
                    {addSaleError}
                  </div>
                )}

                {/* Step 1: Filter by Company */}
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    1. Select Company
                  </label>
                  <select
                    value={addSaleCompanyId}
                    onChange={(e) => {
                      setAddSaleCompanyId(e.target.value);
                      // Reset selected product if it does not belong to the selected company
                      if (e.target.value !== 'all' && addSaleProductId) {
                        const currentP = products.find(p => p.id === addSaleProductId);
                        if (currentP && currentP.companyId !== e.target.value) {
                          setAddSaleProductId('');
                        }
                      }
                    }}
                    className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-blue-500 outline-none font-bold text-slate-900 dark:text-white appearance-none cursor-pointer"
                  >
                    <option value="all">🏢 All Companies ({companies.length} companies)</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Step 2: Search & Select Product */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                      2. Search & Select Product *
                    </label>
                    <span className="text-[10px] font-bold text-slate-400">
                      {modalProducts.length} product{modalProducts.length !== 1 ? 's' : ''} listed
                    </span>
                  </div>

                  {/* Search bar for quick product filtering */}
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search product name..."
                      value={addSaleProductSearch}
                      onChange={(e) => setAddSaleProductSearch(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-blue-500 outline-none text-sm font-semibold text-slate-900 dark:text-white"
                    />
                    {addSaleProductSearch && (
                      <button
                        type="button"
                        onClick={() => setAddSaleProductSearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Product dropdown */}
                  <select
                    value={addSaleProductId}
                    onChange={(e) => setAddSaleProductId(e.target.value)}
                    className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-blue-500 outline-none font-bold text-slate-900 dark:text-white appearance-none cursor-pointer"
                    required
                  >
                    <option value="">Choose product...</option>
                    {modalProducts.map(p => {
                      const stock = stocks.find(s => s.productId === p.id);
                      const comp = companies.find(c => c.id === p.companyId);
                      return (
                        <option key={p.id} value={p.id}>
                          {p.name} {comp ? `(${comp.name})` : ''} - [{stock?.remaining || 0} in stock]
                        </option>
                      );
                    })}
                  </select>

                  {/* Stock preview badge */}
                  {selectedProductObj && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-between border border-blue-100 dark:border-blue-900/30">
                      <span className="text-xs font-bold text-blue-900 dark:text-blue-200">
                        📦 {selectedProductObj.name}
                      </span>
                      <span className={`text-xs font-black px-2.5 py-1 rounded-xl ${
                        stockRemaining > (selectedProductObj.minStock || 5) 
                          ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' 
                          : 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300'
                      }`}>
                        {stockRemaining} {selectedProductObj.unit || 'Units'} Available
                      </span>
                    </div>
                  )}
                </div>

                {/* Customer Name */}
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Customer Name *</label>
                  <input
                    type="text"
                    value={addSaleCustomer}
                    onChange={(e) => setAddSaleCustomer(e.target.value)}
                    className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-blue-500 outline-none font-bold text-slate-900 dark:text-white"
                    placeholder="Enter customer name"
                    required
                  />
                </div>

                {/* Phone Number */}
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Phone Number (Optional - 11 Digits)</label>
                  <input
                    type="tel"
                    maxLength={11}
                    value={addSalePhone}
                    onChange={(e) => setAddSalePhone(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-blue-500 outline-none font-bold text-slate-900 dark:text-white"
                    placeholder="e.g. 03001234567"
                  />
                </div>

                {/* Sale Date */}
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Sale Date *</label>
                  <CustomDatePicker
                    selected={addSaleDate}
                    onChange={(date) => setAddSaleDate(date || new Date())}
                    placeholderText="Select sale date..."
                    maxDate={new Date()}
                  />
                </div>

                {/* Quantity and Total Amount Charged */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                      Quantity *
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={addSaleQty}
                      onChange={(e) => handleQuantityChange(e.target.value)}
                      className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-blue-500 outline-none font-bold text-slate-900 dark:text-white"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                      Total Amount Charged (Rs.) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={addSaleTotalAmount}
                      onChange={(e) => handleTotalAmountChange(e.target.value)}
                      className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-blue-500 outline-none font-bold text-blue-600 dark:text-blue-400"
                      placeholder="e.g. 50000"
                      required
                    />
                  </div>
                </div>

                {/* Calculated Rate per Pack Badge */}
                <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl flex items-center justify-between border border-slate-200 dark:border-slate-700">
                  <div>
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Rate per Pack/Unit:</span>
                    <span className="text-[10px] text-slate-400 ml-1.5">(Total Amount ÷ Quantity)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                      Rs. {addSalePrice || '0'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">/ {selectedProductObj?.unit || 'pack'}</span>
                  </div>
                </div>

                {/* Paid Amount Input */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                      Amount Paid by Customer (Rs.) *
                    </label>
                    <button
                      type="button"
                      onClick={() => handlePaidAmountChange(currentTotal.toString())}
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
                    className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-blue-500 outline-none font-bold text-emerald-600 text-lg"
                    placeholder="Enter amount paid"
                    required
                  />
                </div>

                {/* Paid & Left Breakdown Bar */}
                <div className="bg-slate-50 dark:bg-slate-900/70 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="flex justify-between items-center text-xs font-black uppercase tracking-wider">
                    <span className="text-slate-400">Payment Status:</span>
                    <span className={currentLeft === 0 && currentTotal > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>
                      {currentLeft === 0 && currentTotal > 0 ? "✅ Fully Paid (0 Left)" : `⚠️ Credit / Left: Rs. ${currentLeft.toLocaleString()}`}
                    </span>
                  </div>

                  {/* Visual Progress Bar */}
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden flex">
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

                  <div className="grid grid-cols-3 gap-2 text-center pt-1">
                    <div className="p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Total</p>
                      <p className="text-sm font-black text-slate-800 dark:text-white">Rs. {currentTotal.toLocaleString()}</p>
                    </div>
                    <div className="p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase">Paid</p>
                      <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">Rs. {currentPaid.toLocaleString()}</p>
                    </div>
                    <div className={`p-2.5 bg-white dark:bg-slate-800 rounded-xl border ${currentLeft > 0 ? 'border-rose-200 dark:border-rose-900/30' : 'border-slate-100 dark:border-slate-700'}`}>
                      <p className={`text-[10px] font-bold uppercase ${currentLeft > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>Left</p>
                      <p className={`text-sm font-black ${currentLeft > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>Rs. {currentLeft.toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {/* Payment Type Selection (Auto-updated, can be manually clicked) */}
                <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setAddSalePaymentType('Debit')}
                    className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${addSalePaymentType === 'Debit' ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' : 'text-slate-400'}`}
                  >
                    Debit (Paid)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddSalePaymentType('Credit')}
                    className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${addSalePaymentType === 'Credit' ? 'bg-white dark:bg-slate-700 text-rose-600 shadow-sm' : 'text-slate-400'}`}
                  >
                    Credit (Pending)
                  </button>
                </div>

                <button
                  type="submit"
                  className={`w-full ${addSalePaymentType === 'Debit' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'} text-white font-black py-4 rounded-2xl shadow-xl uppercase tracking-widest mt-2 active:scale-95 transition-all`}
                >
                  Finalize Sale
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
        onConfirm={() => deleteSale(confirmDialog.saleId)}
        onCancel={() => setConfirmDialog({ isOpen: false, saleId: '', customerName: '', productName: '' })}
        isDangerous={true}
      />
    </div>
  );
};

export default SalesPage;
