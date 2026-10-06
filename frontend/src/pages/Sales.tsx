
import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { ShoppingCart, Search, Calendar, Filter, User, Wallet, CreditCard, Download, Phone, Trash2, Pencil, Plus } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import CustomDatePicker from '../components/CustomDatePicker';
import AddSaleModal, { EditSaleGroup } from '../components/AddSaleModal';
import CreditSaleModal from '../components/CreditSaleModal';
import { formatDate, formatAmount } from '../utils/formatters';

const SalesPage: React.FC = () => {
  const { companies, products, sales, deleteSale, deleteInvoice } = useData();
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

  // Edit sale/invoice (reuses the Add Sale form)
  const [editGroup, setEditGroup] = useState<EditSaleGroup | null>(null);

  // Add Sale modal state
  const [isAddSaleModalOpen, setIsAddSaleModalOpen] = useState(false);

  const handleEditGroup = (group: {
    invoiceId?: string;
    invoiceNo?: string;
    customerName: string;
    customerPhone?: string;
    dealerName?: string;
    date: string;
    paidAmount: number;
    items: Array<{ saleId: string; productId: string; quantity: number; sellingPrice: number; totalAmount: number }>;
  }) => {
    setEditGroup({
      invoiceId: group.invoiceId,
      invoiceNo: group.invoiceNo,
      customerName: group.customerName,
      customerPhone: group.customerPhone,
      date: group.date,
      paidAmount: group.paidAmount,
      isDealer: !!group.dealerName,
      items: group.items.map(i => ({
        saleId: i.saleId,
        productId: i.productId,
        quantity: i.quantity,
        sellingPrice: i.sellingPrice,
        totalAmount: i.totalAmount
      }))
    });
  };

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

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">Ledger Records</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Detailed transaction logs and filter options</p>
        </div>
        <div className="grid grid-cols-3 gap-2 md:flex md:flex-wrap md:gap-3">
          <button
            onClick={() => setIsAddSaleModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-3 md:px-7 md:py-4 rounded-xl md:rounded-2xl flex items-center justify-center gap-1.5 md:gap-2.5 text-[11px] md:text-base font-bold shadow-xl shadow-blue-600/20 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4 md:w-5 md:h-5 stroke-[3px]" />
            CASH SALE
          </button>
          <button
            onClick={() => setIsCreditSaleModalOpen(true)}
            className="bg-rose-600 hover:bg-rose-700 text-white px-2 py-3 md:px-7 md:py-4 rounded-xl md:rounded-2xl flex items-center justify-center gap-1.5 md:gap-2.5 text-[11px] md:text-base font-bold shadow-xl shadow-rose-600/20 active:scale-95 transition-all"
          >
            <CreditCard className="w-4 h-4 md:w-5 md:h-5 stroke-[2.5px]" />
            CREDIT SALE
          </button>
          <button
            onClick={exportToExcel}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-3 md:px-7 md:py-4 rounded-xl md:rounded-2xl flex items-center justify-center gap-1.5 md:gap-2.5 text-[11px] md:text-base font-bold shadow-xl shadow-emerald-600/20 active:scale-95 transition-all"
          >
            <Download className="w-4 h-4 md:w-5 md:h-5" />
            EXPORT CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:gap-6">
        <div className="bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-800/20 p-3 md:p-6 rounded-2xl md:rounded-3xl flex justify-between items-center group transition-all hover:shadow-lg">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-rose-600">Credit (Pending)</p>
            <h3 className="text-lg md:text-3xl font-black text-rose-700 dark:text-rose-400">Rs. {formatAmount(totalCredit)}</h3>
          </div>
          <CreditCard className="hidden sm:block w-10 h-10 text-rose-300 group-hover:scale-110 transition-transform" />
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/20 p-3 md:p-6 rounded-2xl md:rounded-3xl flex justify-between items-center group transition-all hover:shadow-lg">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Debit (Paid)</p>
            <h3 className="text-lg md:text-3xl font-black text-emerald-700 dark:text-emerald-400">Rs. {formatAmount(totalDebit)}</h3>
          </div>
          <Wallet className="hidden sm:block w-10 h-10 text-emerald-300 group-hover:scale-110 transition-transform" />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200/60 dark:border-slate-700 space-y-3 md:space-y-5">
        <div className="flex flex-col xl:flex-row gap-3 xl:gap-6">
          <div className="relative flex-1">
            <Search className="absolute left-4 md:left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Filter by customer, phone or product..."
              className="w-full pl-11 md:pl-14 pr-4 md:pr-6 py-3 md:py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-none outline-none font-bold text-slate-900 dark:text-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2 md:gap-4 items-center">
            <div className="flex w-full sm:w-auto bg-slate-100 dark:bg-slate-900 p-1 md:p-1.5 rounded-2xl [&>button]:flex-1 sm:[&>button]:flex-none">
              <button onClick={() => setPaymentFilter('all')} className={`px-2 sm:px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${paymentFilter === 'all' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-400'}`}>All</button>
              <button onClick={() => setPaymentFilter('Debit')} className={`px-2 sm:px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${paymentFilter === 'Debit' ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' : 'text-slate-400'}`}>Paid Only</button>
              <button onClick={() => setPaymentFilter('Credit')} className={`px-2 sm:px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${paymentFilter === 'Credit' ? 'bg-white dark:bg-slate-700 text-rose-600 shadow-sm' : 'text-slate-400'}`}>Pending Only</button>
            </div>

            {/* Date Filter with Quick Navigation */}
            <div className="flex flex-wrap items-center gap-2 md:gap-3 w-full sm:w-auto">
              {/* Quick Day Buttons */}
              <div className="flex w-full sm:w-auto bg-slate-100 dark:bg-slate-900 p-1 md:p-1.5 rounded-2xl gap-1 [&>button]:flex-1 sm:[&>button]:flex-none">
                <button
                  onClick={() => {
                    setSpecificDate(new Date());
                    setTimeFilter('day');
                  }}
                  className={`px-2 sm:px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${specificDate && specificDate.toDateString() === new Date().toDateString()
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
                  className={`px-2 sm:px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${specificDate && specificDate.toDateString() === new Date(new Date().setDate(new Date().getDate() - 1)).toDateString()
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
                  className={`px-2 sm:px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${timeFilter === 'all' && !specificDate ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-600' : 'text-slate-400'
                    }`}
                >
                  All Time
                </button>
              </div>

              {/* Custom Date Picker */}
              <div className="w-full sm:w-48">
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

      {/* Mobile: one card per invoice */}
      <div className="md:hidden space-y-2.5">
        {groupedSales.map((group) => {
          const isMultiItem = group.items.length > 1;
          return (
            <div key={group.key} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/70 dark:border-slate-700 p-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-black text-sm text-slate-900 dark:text-white truncate">{group.customerName}</p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[10px] font-bold text-slate-400">
                    <span>{formatDate(group.date)}</span>
                    {group.customerPhone && (
                      <span className="flex items-center gap-0.5 text-blue-500"><Phone className="w-2.5 h-2.5" />{group.customerPhone}</span>
                    )}
                    {group.invoiceNo && <span className="font-mono">#{group.invoiceNo}</span>}
                  </div>
                  {(group.dealerName || isMultiItem) && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {group.dealerName && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">Dealer: {group.dealerName}</span>
                      )}
                      {isMultiItem && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">{group.items.length} Products</span>
                      )}
                    </div>
                  )}
                </div>
                <span className={`shrink-0 px-2.5 py-1 rounded-full whitespace-nowrap text-[9px] font-black uppercase tracking-wider ${group.paymentType === 'Debit' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'}`}>
                  {group.paymentType === 'Debit' ? 'Paid' : 'Pending'}
                </span>
              </div>

              <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 space-y-1">
                {group.items.map((item, idx) => (
                  <div key={idx} className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate">{item.productName}</span>
                    <span className="shrink-0 text-[11px] text-slate-500 dark:text-slate-400 font-bold whitespace-nowrap">
                      {item.quantity} × {formatAmount(item.sellingPrice)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 flex items-end justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-black text-base text-slate-900 dark:text-white whitespace-nowrap">Rs. {formatAmount(group.totalAmount)}</p>
                  <p className="text-[10px] font-bold whitespace-nowrap">
                    <span className="text-emerald-600 dark:text-emerald-400">Paid {formatAmount(group.paidAmount)}</span>
                    {group.left > 0 && <span className="text-rose-600 dark:text-rose-400 ml-2">Left {formatAmount(group.left)}</span>}
                  </p>
                  <p className={`text-[10px] font-black whitespace-nowrap ${group.totalProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    Profit {group.totalProfit >= 0 ? '+' : '-'}Rs. {formatAmount(Math.abs(group.totalProfit))}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleEditGroup(group)}
                    className="p-2.5 text-slate-500 hover:text-blue-500 bg-slate-100 dark:bg-slate-700 rounded-xl"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
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
                    className="p-2.5 text-slate-500 hover:text-rose-500 bg-slate-100 dark:bg-slate-700 rounded-xl"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {groupedSales.length === 0 && (
          <div className="py-16 text-center text-slate-400">
            <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-10" />
            <p className="font-bold">No transactions found.</p>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-slate-800 hidden md:block rounded-3xl p-2 shadow-sm border border-slate-200/60 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-[10px] uppercase text-slate-400 font-black tracking-widest border-b border-slate-100 dark:border-slate-700">
              <tr>
                <th className="px-4 py-2.5">Customer Details</th>
                <th className="px-4 py-2.5">Product Item</th>
                <th className="px-4 py-2.5 text-center">Volume</th>
                <th className="px-4 py-2.5 text-center">Payment Status</th>
                <th className="px-4 py-2.5 text-right">Total Invoice</th>
                <th className="px-4 py-2.5 text-right text-emerald-500">Profit</th>
                <th className="px-4 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {groupedSales.map((group) => {
                const isMultiItem = group.items.length > 1;
                const totalQty = group.items.reduce((sum, item) => sum + item.quantity, 0);
                
                return (
                  <tr key={group.key} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                    <td className="px-4 py-2.5">
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
                        <div className="flex items-center gap-3 mt-0.5 text-[10px] font-bold text-slate-400">
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
                    <td className="px-4 py-2.5">
                      {group.items.length === 1 ? (
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white text-sm leading-tight">
                            {group.items[0].productName}
                          </p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">
                            Rs. {formatAmount(group.items[0].sellingPrice)}/ea
                            {group.items[0].companyName ? ` • ${group.items[0].companyName}` : ''}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-0.5 max-w-sm">
                          {group.items.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs py-0 border-b border-slate-100 dark:border-slate-800 last:border-0">
                              <span className="font-bold text-slate-800 dark:text-slate-200 truncate mr-2" title={item.productName}>
                                • {item.productName}
                              </span>
                              <span className="text-[10px] text-slate-400 font-bold whitespace-nowrap">
                                {item.quantity} pk × Rs. {formatAmount(item.sellingPrice)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center text-slate-600 dark:text-slate-400 font-bold">
                      {totalQty}
                      {isMultiItem && (
                        <p className="text-[9px] text-slate-400 uppercase font-semibold">({group.items.length} items)</p>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`px-3 py-1 rounded-full whitespace-nowrap text-[10px] font-black uppercase tracking-widest ${group.paymentType === 'Debit' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'}`}>
                        {group.paymentType === 'Debit' ? 'Paid (Debit)' : 'Credit (Pending)'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="font-black text-slate-900 dark:text-white text-sm whitespace-nowrap">
                        Rs. {formatAmount(group.totalAmount)}
                      </div>
                      <div className="flex flex-col items-end gap-0 mt-0.5 text-[10px] font-bold whitespace-nowrap">
                        <span className="text-emerald-600 dark:text-emerald-400">Paid: Rs. {formatAmount(group.paidAmount)}</span>
                        {group.left > 0 ? (
                          <span className="text-rose-600 dark:text-rose-400 font-extrabold">Left: Rs. {formatAmount(group.left)}</span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 font-medium">✓ Cleared</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`font-black text-sm whitespace-nowrap ${group.totalProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {group.totalProfit >= 0 ? '+' : ''}Rs. {formatAmount(Math.abs(group.totalProfit))}
                      </span>
                      {group.items.length > 1 && (
                        <p className="text-[9px] text-slate-400 font-bold mt-0.5 uppercase">{group.items.length} items</p>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleEditGroup(group)}
                          className="p-1.5 text-slate-400 hover:text-blue-500 transition-colors bg-slate-50 dark:bg-slate-800 rounded-lg"
                          title={isMultiItem ? 'Edit Invoice' : 'Edit Sale'}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
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
                          className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors bg-slate-50 dark:bg-slate-800 rounded-lg"
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
                  <td colSpan={7} className="py-16 text-center text-slate-400">
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

      {/* Edit Sale / Invoice (same form as Add Sale) */}
      <AddSaleModal
        isOpen={!!editGroup}
        onClose={() => setEditGroup(null)}
        editGroup={editGroup}
      />

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
