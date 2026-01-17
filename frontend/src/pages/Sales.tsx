
import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { ShoppingCart, Search, Calendar, Filter, User, Wallet, CreditCard, Download, Phone, Trash2 } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';

const SalesPage: React.FC = () => {
  const { products, sales, deleteSale } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [timeFilter, setTimeFilter] = useState<'all' | 'day' | 'month' | 'year'>('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'Credit' | 'Debit'>('all');
  const [specificDate, setSpecificDate] = useState<string>('');

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    saleId: '',
    customerName: '',
    productName: ''
  });

  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      const product = products.find(p => p.id === s.productId);
      const matchesSearch = product?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.customerPhone && s.customerPhone.includes(searchTerm));

      const matchesPayment = paymentFilter === 'all' || s.paymentType === paymentFilter;

      if (!matchesSearch || !matchesPayment) return false;

      const saleDateString = new Date(s.date).toISOString().split('T')[0];

      if (specificDate) {
        return saleDateString === specificDate;
      }

      const saleDate = new Date(s.date);
      const now = new Date();

      if (timeFilter === 'day') {
        return saleDate.toDateString() === now.toDateString();
      } else if (timeFilter === 'month') {
        return saleDate.getMonth() === now.getMonth() && saleDate.getFullYear() === now.getFullYear();
      } else if (timeFilter === 'year') {
        return saleDate.getFullYear() === now.getFullYear();
      }
      return true;
    });
  }, [sales, products, searchTerm, timeFilter, paymentFilter, specificDate]);

  const totalCredit = filteredSales.filter(s => s.paymentType === 'Credit').reduce((acc, s) => acc + s.totalAmount, 0);
  const totalDebit = filteredSales.filter(s => s.paymentType === 'Debit').reduce((acc, s) => acc + s.totalAmount, 0);

  const exportToExcel = () => {
    const headers = ['Date', 'Customer', 'Phone', 'Product', 'Quantity', 'Rate', 'Total', 'Payment Status'];
    const rows = filteredSales.map(s => {
      const p = products.find(prod => prod.id === s.productId);
      return [
        new Date(s.date).toLocaleDateString(),
        s.customerName,
        s.customerPhone || 'N/A',
        p?.name || 'Item',
        s.quantity,
        s.sellingPrice,
        s.totalAmount,
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Ledger Records</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Detailed transaction logs and filter options</p>
        </div>
        <button
          onClick={exportToExcel}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-2xl flex items-center gap-3 font-bold shadow-xl shadow-emerald-600/20 active:scale-95 transition-all"
        >
          <Download className="w-5 h-5" />
          EXPORT CSV
        </button>
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

            <div className="flex bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl items-center gap-2">
              <button onClick={() => { setTimeFilter('all'); setSpecificDate(''); }} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${timeFilter === 'all' && !specificDate ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600' : 'text-slate-400'}`}>All Time</button>

              <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-2 self-center" />

              <div className="flex items-center gap-1">
                <span className="text-[8px] font-black text-slate-400 uppercase">Select Date:</span>
                <input
                  type="date"
                  value={specificDate}
                  onChange={(e) => { setSpecificDate(e.target.value); setTimeFilter('all'); }}
                  className="bg-transparent text-[10px] font-black uppercase px-2 outline-none text-slate-600 dark:text-slate-300"
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
                      <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${sale.paymentType === 'Debit' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {sale.paymentType}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-right font-black text-slate-900 dark:text-white text-lg">
                      Rs. {sale.totalAmount.toLocaleString()}
                    </td>
                    <td className="px-8 py-6 text-right">
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
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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
