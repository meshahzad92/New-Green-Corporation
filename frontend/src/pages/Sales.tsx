
import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Sale } from '../types';
import { ShoppingCart, Search, Calendar, Filter, User, Wallet, CreditCard, Download, Phone, Trash2, Pencil, Plus, X } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import CustomDatePicker from '../components/CustomDatePicker';
import AddSaleModal from '../components/AddSaleModal';
import CreditSaleModal from '../components/CreditSaleModal';
import { formatDate } from '../utils/formatters';

const SalesPage: React.FC = () => {
  const { companies, products, sales, stocks, deleteSale, deleteInvoice, updateSale, addSale, addBulkSale } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [timeFilter, setTimeFilter] = useState<'all' | 'day' | 'month' | 'year'>('day'); // Default to today
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'Credit' | 'Debit'>('all');
  const [specificDate, setSpecificDate] = useState<Date | null>(new Date()); // Today by default
  const [isCreditSaleModalOpen, setIsCreditSaleModalOpen] = useState(false);

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
    saleDate: Date;
  }>({
    isOpen: false,
    sale: null,
    productId: '',
    customerName: '',
    customerPhone: '',
    quantity: 0,
    sellingPrice: 0,
    paidAmount: 0,
    paymentType: 'Credit',
    saleDate: new Date()
  });

  // Add Sale modal state
  const [isAddSaleModalOpen, setIsAddSaleModalOpen] = useState(false);

  // Invoice edit modal state (for multi-item invoices)
  const [editInvoiceModal, setEditInvoiceModal] = useState<{
    isOpen: boolean;
    invoiceId: string;
    saleIds: string[];          // all sale IDs in this invoice
    itemTotals: number[];       // totalAmount per item (for payment redistribution)
    customerName: string;
    customerPhone: string;
    saleDate: Date;
    totalInvoice: number;
    paidAmount: number;
    paymentType: 'Credit' | 'Debit';
  }>({
    isOpen: false,
    invoiceId: '',
    saleIds: [],
    itemTotals: [],
    customerName: '',
    customerPhone: '',
    saleDate: new Date(),
    totalInvoice: 0,
    paidAmount: 0,
    paymentType: 'Debit'
  });

  const [isSubmittingInvoiceEdit, setIsSubmittingInvoiceEdit] = useState(false);

  const handleEditInvoice = (group: {
    invoiceId?: string;
    customerName: string;
    customerPhone?: string;
    date: string;
    totalAmount: number;
    paidAmount: number;
    paymentType: 'Credit' | 'Debit';
    items: Array<{ saleId: string; totalAmount: number }>;
  }) => {
    const saleIds = group.items.map(i => i.saleId);
    const itemTotals = group.items.map(i => i.totalAmount);
    setEditInvoiceModal({
      isOpen: true,
      invoiceId: group.invoiceId || '',
      saleIds,
      itemTotals,
      customerName: group.customerName,
      customerPhone: group.customerPhone || '',
      saleDate: new Date(group.date),
      totalInvoice: group.totalAmount,
      paidAmount: group.paidAmount,
      paymentType: group.paymentType
    });
  };

  const handleSaveInvoiceEdit = async () => {
    if (isSubmittingInvoiceEdit) return;
    setIsSubmittingInvoiceEdit(true);
    try {
      // Distribute paid amount sequentially across items (fill item 1 first, then item 2 …)
      let remaining = editInvoiceModal.paidAmount;
      const updates = editInvoiceModal.saleIds.map((saleId, idx) => {
        const itemTotal = editInvoiceModal.itemTotals[idx];
        const itemPaid = Math.min(remaining, itemTotal);
        remaining = Math.max(0, remaining - itemTotal);
        const itemPaymentType: 'Credit' | 'Debit' = itemPaid >= itemTotal ? 'Debit' : 'Credit';
        return { saleId, itemPaid, itemPaymentType };
      });

      // Update all items in parallel
      const results = await Promise.all(
        updates.map(({ saleId, itemPaid, itemPaymentType }) =>
          updateSale(saleId, {
            customerName: editInvoiceModal.customerName,
            customerPhone: editInvoiceModal.customerPhone,
            saleDate: editInvoiceModal.saleDate,
            paidAmount: itemPaid,
            paymentType: itemPaymentType
          })
        )
      );

      if (results.every(Boolean)) {
        setEditInvoiceModal(prev => ({ ...prev, isOpen: false }));
      }
    } catch (err) {
      console.error('Failed to update invoice:', err);
    } finally {
      setIsSubmittingInvoiceEdit(false);
    }
  };

  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

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
      dealerName?: string;
      farmerName?: string;
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
          dealerName: s.dealerName,
          farmerName: s.farmerName,
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
        formatDate(s.date),
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
      paymentType: sale.paymentType,
      saleDate: new Date(sale.date)
    });
  };

  const handleSaveEdit = async () => {
    if (!editModal.sale || isSubmittingEdit) return;

    setIsSubmittingEdit(true);
    try {
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
        paymentType: finalPaymentType,
        saleDate: editModal.saleDate
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
          paymentType: 'Credit',
          saleDate: new Date()
        });
      }
    } catch (err) {
      console.error('Failed to update sale:', err);
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Ledger Records</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Detailed transaction logs and filter options</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setIsAddSaleModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-7 py-4 rounded-2xl flex items-center gap-2.5 font-bold shadow-xl shadow-blue-600/20 active:scale-95 transition-all"
          >
            <Plus className="w-5 h-5 stroke-[3px]" />
            CASH SALE
          </button>
          <button
            onClick={() => setIsCreditSaleModalOpen(true)}
            className="bg-rose-600 hover:bg-rose-700 text-white px-7 py-4 rounded-2xl flex items-center gap-2.5 font-bold shadow-xl shadow-rose-600/20 active:scale-95 transition-all"
          >
            <CreditCard className="w-5 h-5 stroke-[2.5px]" />
            CREDIT SALE
          </button>
          <button
            onClick={exportToExcel}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-7 py-4 rounded-2xl flex items-center gap-2.5 font-bold shadow-xl shadow-emerald-600/20 active:scale-95 transition-all"
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
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Products Sold {specificDate ? `on ${formatDate(specificDate)}` : 'Today'}</h3>
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
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-slate-900 dark:text-white">
                            {group.customerName}
                          </span>
                          {group.dealerName && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">
                              Dealer: {group.dealerName}
                            </span>
                          )}
                          {isMultiItem && (
                            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                              {group.items.length} Products
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[10px] font-bold text-slate-400">
                          <span className="uppercase">{formatDate(group.date)}</span>
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
                        {/* Edit — single item uses editSale, multi-item uses editInvoice */}
                        {!isMultiItem && firstSale ? (
                          <button
                            onClick={() => handleEditSale(firstSale)}
                            className="p-2 text-slate-400 hover:text-blue-500 transition-colors bg-slate-50 dark:bg-slate-800 rounded-lg"
                            title="Edit Sale"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleEditInvoice(group)}
                            className="p-2 text-slate-400 hover:text-blue-500 transition-colors bg-slate-50 dark:bg-slate-800 rounded-lg"
                            title="Edit Invoice"
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
      <AddSaleModal
        isOpen={isAddSaleModalOpen}
        onClose={() => setIsAddSaleModalOpen(false)}
        initialDate={specificDate}
      />

      {/* Credit Sale & Recovery Modal */}
      <CreditSaleModal
        isOpen={isCreditSaleModalOpen}
        onClose={() => setIsCreditSaleModalOpen(false)}
        initialDate={specificDate}
      />

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

              {/* Sale Date */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Sale Date</label>
                <CustomDatePicker
                  selected={editModal.saleDate}
                  onChange={(date) => setEditModal({ ...editModal, saleDate: date || new Date() })}
                  placeholderText="Select sale date..."
                  maxDate={new Date()}
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
                disabled={isSubmittingEdit}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-2xl uppercase tracking-widest shadow-xl shadow-emerald-600/30 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmittingEdit ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving Changes...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Invoice Modal — for multi-item invoices */}
      {editInvoiceModal.isOpen && (() => {
        const left = Math.max(0, editInvoiceModal.totalInvoice - editInvoiceModal.paidAmount);
        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
              <div className="p-8 border-b border-slate-200 dark:border-slate-700 flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white">Edit Invoice</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Update details for all {editInvoiceModal.saleIds.length} items in this invoice
                  </p>
                </div>
                <button onClick={() => setEditInvoiceModal(prev => ({ ...prev, isOpen: false }))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <div className="p-8 space-y-6">
                {/* Customer Name */}
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Customer Name</label>
                  <input
                    type="text"
                    value={editInvoiceModal.customerName}
                    onChange={(e) => setEditInvoiceModal(prev => ({ ...prev, customerName: e.target.value }))}
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-emerald-500 outline-none font-bold text-slate-900 dark:text-white"
                    placeholder="Enter customer name"
                  />
                </div>

                {/* Customer Phone */}
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Customer Phone (Optional)</label>
                  <input
                    type="tel"
                    value={editInvoiceModal.customerPhone}
                    onChange={(e) => setEditInvoiceModal(prev => ({ ...prev, customerPhone: e.target.value }))}
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-emerald-500 outline-none font-bold text-slate-900 dark:text-white"
                    placeholder="03001234567"
                    maxLength={11}
                  />
                </div>

                {/* Sale Date */}
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Sale Date</label>
                  <CustomDatePicker
                    selected={editInvoiceModal.saleDate}
                    onChange={(date) => setEditInvoiceModal(prev => ({ ...prev, saleDate: date || new Date() }))}
                    placeholderText="Select sale date..."
                    maxDate={new Date()}
                  />
                </div>

                {/* Paid Amount */}
                <div className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Amount Paid (Rs.)</label>
                      <button
                        type="button"
                        onClick={() => setEditInvoiceModal(prev => ({ ...prev, paidAmount: prev.totalInvoice, paymentType: 'Debit' }))}
                        className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Set Full Payment
                      </button>
                    </div>
                    <input
                      type="number"
                      value={editInvoiceModal.paidAmount}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setEditInvoiceModal(prev => ({
                          ...prev,
                          paidAmount: val,
                          paymentType: val >= prev.totalInvoice ? 'Debit' : 'Credit'
                        }));
                      }}
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-emerald-500 outline-none font-bold text-emerald-600 text-base"
                      min="0"
                      step="any"
                    />
                  </div>

                  {/* Summary */}
                  <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-4 border-2 border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-black uppercase tracking-widest text-slate-400">Total Invoice:</span>
                      <span className="text-xl font-black text-slate-900 dark:text-white">Rs. {editInvoiceModal.totalInvoice.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="text-emerald-600 dark:text-emerald-400">Paid: Rs. {editInvoiceModal.paidAmount.toLocaleString()}</span>
                      <span className={left > 0 ? 'text-rose-600 dark:text-rose-400 font-extrabold' : 'text-slate-400'}>
                        {left > 0 ? `Left: Rs. ${left.toLocaleString()}` : '✓ Fully Paid'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-8 border-t border-slate-200 dark:border-slate-700 flex gap-4">
                <button
                  onClick={() => setEditInvoiceModal(prev => ({ ...prev, isOpen: false }))}
                  className="flex-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-black py-4 rounded-2xl uppercase tracking-widest hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveInvoiceEdit}
                  disabled={isSubmittingInvoiceEdit}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-2xl uppercase tracking-widest shadow-xl shadow-emerald-600/30 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmittingInvoiceEdit ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving Changes...
                    </>
                  ) : (
                    'Save Invoice Changes'
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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
