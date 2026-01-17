
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { ArrowLeft, Package, ShoppingCart, Layers, Plus, TrendingUp, User, Building2, Calendar, History, Phone, CreditCard, Wallet, Banknote, X, Trash2 } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';

const ProductDetail: React.FC = () => {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { products, stocks, sales, companies, addStock, addSale, stockTransactions, deleteSale, deleteStockTransaction } = useData();

  const product = products.find(p => p.id === productId);
  const stock = stocks.find(s => s.productId === productId);
  const company = companies.find(c => c.id === product?.companyId);
  const productSales = sales.filter(s => s.productId === productId);
  const productLogs = stockTransactions.filter(t => t.productId === productId && t.type === 'IN');

  const combinedHistory = React.useMemo(() => {
    const history = [
      ...productLogs.map(l => ({ ...l, entryType: 'REFILL' as const })),
      ...productSales.map(s => ({ ...s, entryType: 'SALE' as const }))
    ];
    return history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [productLogs, productSales]);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSellModalOpen, setIsSellModalOpen] = useState(false);

  // Refill Form
  const [addQty, setAddQty] = useState('0');
  const [addParty, setAddParty] = useState('');
  const [addPrice, setAddPrice] = useState(product?.purchasePrice.toString() || '0');

  // Sell Form
  const [sellQty, setSellQty] = useState('1');
  const [sellCustomer, setSellCustomer] = useState('');
  const [sellPhone, setSellPhone] = useState('');
  const [sellPrice, setSellPrice] = useState('0');
  const [paymentType, setPaymentType] = useState<'Credit' | 'Debit'>('Debit');
  const [sellError, setSellError] = useState('');

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    entryId: '',
    isRefill: false,
    partyName: '',
    customerName: ''
  });

  if (!product) return null;

  const handleAddStockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = parseInt(addQty);
    const p = parseFloat(addPrice);
    if (q > 0 && addParty.trim()) {
      addStock(product.id, q, addParty, p);
      setIsAddModalOpen(false);
      setAddQty('0');
      setAddParty('');
    }
  };

  const handleSellSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = parseInt(sellQty);
    const p = parseFloat(sellPrice);

    // Validation
    if (!q || q <= 0 || !sellCustomer.trim()) return;

    if (sellPhone.trim() && !/^\d{11}$/.test(sellPhone.trim())) {
      setSellError('Phone number must be exactly 11 digits (e.g. 03001234567)');
      return;
    }

    if (q > (stock?.remaining || 0)) {
      setSellError(`Insufficient Stock! Available: ${stock?.remaining}`);
      return;
    }

    const success = addSale(product.id, q, sellCustomer, p, paymentType, sellPhone.trim());
    if (success) {
      setIsSellModalOpen(false);
      setSellQty('1');
      setSellCustomer('');
      setSellPhone('');
      setSellError('');
    }
  };

  const handleNumChange = (setter: React.Dispatch<React.SetStateAction<string>>, val: string) => {
    if (val.length > 1 && val.startsWith('0')) setter(val.slice(1));
    else setter(val);
  };

  const inventoryValuation = (stock?.remaining || 0) * product.purchasePrice;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/products')} className="p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 hover:text-emerald-600 transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">{product.name}</h1>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">{company?.name} • Category: {product.category}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Status Card */}
        <div className="md:col-span-2 bg-emerald-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-emerald-600/20 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Inventory Balance</p>
              <h2 className="text-5xl md:text-6xl font-black mt-1 tracking-tighter">{stock?.remaining || 0}</h2>
              <p className="text-xs font-bold mt-2 uppercase">{product.unit} In Stock</p>
            </div>
            <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-md">
              <Layers className="w-10 h-10 md:w-12 md:h-12" />
            </div>
          </div>
          <div className="mt-10 flex flex-col sm:flex-row gap-4">
            <button onClick={() => { setSellPrice(''); setIsSellModalOpen(true); }} className="flex-1 bg-white text-emerald-600 font-black py-4 rounded-2xl shadow-lg transition-transform hover:scale-105 active:scale-95">SELL PRODUCT</button>
            <button onClick={() => setIsAddModalOpen(true)} className="flex-1 bg-emerald-500 text-white font-black py-4 rounded-2xl shadow-lg hover:bg-emerald-400 transition-colors active:scale-95">REFILL STOCK</button>
          </div>
        </div>

        {/* Financial Position */}
        <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-700 space-y-6 flex flex-col justify-center">
          <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Stock Valuation</p>
          <h4 className="text-2xl md:text-3xl font-black text-blue-600 leading-none">Rs. {inventoryValuation.toLocaleString()}</h4>
          <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
            <div className="flex justify-between items-center text-xs font-bold text-slate-500 mb-2">
              <span>Latest Cost</span>
              <span className="text-slate-900 dark:text-white font-black">Rs. {product.purchasePrice.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-xs font-bold text-slate-500">
              <span>Unit Label</span>
              <span className="text-slate-900 dark:text-white font-black">{product.unit}</span>
            </div>
          </div>
        </div>

        {/* Flow Stats */}
        <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-center space-y-6">
          <div>
            <p className="text-[10px] font-black uppercase text-emerald-600">Total Arrivals</p>
            <p className="text-2xl font-black">{stock?.totalIn} <span className="text-xs font-bold opacity-50 uppercase">{product.unit}</span></p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-orange-600">Total Sales</p>
            <p className="text-2xl font-black">{stock?.totalOut} <span className="text-xs font-bold opacity-50 uppercase">{product.unit}</span></p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <h2 className="text-xl font-black flex items-center gap-3">
            <History className="text-emerald-500" />
            Transaction History
          </h2>
        </div>

        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-left">
            <thead className="text-[10px] uppercase text-slate-400 font-black tracking-widest bg-slate-50 dark:bg-slate-900/50">
              <tr>
                <th className="px-8 py-5">Date / Type</th>
                <th className="px-8 py-5">Party / Customer</th>
                <th className="px-8 py-5 text-center">Quantity</th>
                <th className="px-8 py-5 text-center">Payment</th>
                <th className="px-8 py-5 text-right">Amount</th>
                <th className="px-8 py-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {combinedHistory.map(entry => {
                const isRefill = entry.entryType === 'REFILL';
                return (
                  <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/20 group transition-colors">
                    <td className="px-8 py-5">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-500">{new Date(entry.date).toLocaleDateString()}</span>
                        <span className={`text-[9px] font-black uppercase tracking-tighter mt-0.5 ${isRefill ? 'text-emerald-500' : 'text-blue-500'}`}>
                          {isRefill ? 'Inventory Refill' : 'Customer Sale'}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <p className="text-sm font-black text-slate-900 dark:text-white">
                        {isRefill ? (entry as any).partyName : (entry as any).customerName}
                      </p>
                      {!isRefill && (entry as any).customerPhone && (
                        <p className="text-[10px] text-slate-400 font-bold flex items-center gap-1 mt-0.5">
                          <Phone className="w-2.5 h-2.5" /> {(entry as any).customerPhone}
                        </p>
                      )}
                    </td>
                    <td className="px-8 py-5 text-center">
                      <span className={`px-3 py-1 rounded-lg font-black text-xs ${isRefill ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-600'}`}>
                        {isRefill ? '+' : '-'}{entry.quantity}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-center">
                      {!isRefill ? (
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${(entry as any).paymentType === 'Debit' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                          {(entry as any).paymentType}
                        </span>
                      ) : (
                        <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">N/A</span>
                      )}
                    </td>
                    <td className="px-8 py-5 text-right font-black text-sm">
                      Rs. {(isRefill ? (entry as any).purchasePrice : (entry as any).totalAmount).toLocaleString()}
                    </td>
                    <td className="px-8 py-5 text-right">
                      <button
                        onClick={() => {
                          setConfirmDialog({
                            isOpen: true,
                            entryId: entry.id,
                            isRefill: isRefill,
                            partyName: isRefill ? (entry as any).partyName : '',
                            customerName: !isRefill ? (entry as any).customerName : ''
                          });
                        }}
                        className="p-2 text-slate-300 hover:text-rose-500 transition-colors bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {combinedHistory.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-24 text-center text-slate-300 font-bold">
                    <History className="w-12 h-12 mx-auto mb-4 opacity-10" />
                    No transactions recorded for this product.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODALS */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/20">
            <div className="bg-emerald-600 p-8 text-white flex justify-between items-center">
              <h2 className="text-2xl font-black">Stock Refill</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full"><X /></button>
            </div>
            <form onSubmit={handleAddStockSubmit} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-500">Party Name (Supplier) *</label>
                <input type="text" value={addParty} onChange={(e) => setAddParty(e.target.value)} className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-emerald-500 outline-none font-bold text-slate-900 dark:text-white" placeholder="Required" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-500">Refill Quantity *</label>
                  <input type="number" min="1" value={addQty} onChange={(e) => handleNumChange(setAddQty, e.target.value)} className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-emerald-500 outline-none font-bold text-slate-900 dark:text-white" required />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-500">Purchase Cost *</label>
                  <input type="number" value={addPrice} onChange={(e) => handleNumChange(setAddPrice, e.target.value)} className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-emerald-500 outline-none font-bold text-emerald-600" required />
                </div>
              </div>
              <button type="submit" className="w-full bg-emerald-600 text-white font-black py-4 rounded-2xl shadow-xl uppercase tracking-widest active:scale-95 transition-all">Add To Stock</button>
            </form>
          </div>
        </div>
      )}

      {isSellModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/20">
            <div className="bg-blue-600 p-8 text-white flex justify-between items-center">
              <h2 className="text-2xl font-black">Generate Sale</h2>
              <button onClick={() => setIsSellModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full"><X /></button>
            </div>
            <form onSubmit={handleSellSubmit} className="p-8 space-y-5">
              {sellError && <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl font-bold text-[10px] md:text-xs uppercase tracking-tight">{sellError}</div>}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-500">Customer Name *</label>
                <input type="text" value={sellCustomer} onChange={(e) => setSellCustomer(e.target.value)} className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-blue-500 outline-none font-bold text-slate-900 dark:text-white" required />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-500">Phone Number (Optional - 11 Digits)</label>
                <input
                  type="tel"
                  maxLength={11}
                  value={sellPhone}
                  onChange={(e) => setSellPhone(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-blue-500 outline-none font-bold text-slate-900 dark:text-white"
                  placeholder="e.g. 03001234567"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-500">Qty ({product.unit}) *</label>
                  <input type="number" min="1" value={sellQty} onChange={(e) => handleNumChange(setSellQty, e.target.value)} className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-blue-500 outline-none font-bold text-slate-900 dark:text-white" required />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-500">Rate (Rs.) *</label>
                  <input type="number" value={sellPrice} onChange={(e) => handleNumChange(setSellPrice, e.target.value)} className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-blue-500 outline-none font-bold text-emerald-600" required />
                </div>
              </div>
              <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl">
                <button type="button" onClick={() => setPaymentType('Debit')} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${paymentType === 'Debit' ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' : 'text-slate-400'}`}>Debit (Paid)</button>
                <button type="button" onClick={() => setPaymentType('Credit')} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${paymentType === 'Credit' ? 'bg-white dark:bg-slate-700 text-rose-600 shadow-sm' : 'text-slate-400'}`}>Credit (Pending)</button>
              </div>
              <button type="submit" className={`w-full ${paymentType === 'Debit' ? 'bg-emerald-600' : 'bg-rose-600'} text-white font-black py-4 rounded-2xl shadow-xl uppercase tracking-widest mt-2 active:scale-95 transition-all`}>Finalize Sale</button>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={`Remove ${confirmDialog.isRefill ? 'Stock Refill' : 'Sale'} Entry`}
        message={`Are you sure you want to remove this ${confirmDialog.isRefill ? 'refill from "' + confirmDialog.partyName + '"' : 'sale to "' + confirmDialog.customerName + '"'}? This will adjust your stock balance accordingly.`}
        confirmText="Yes, Remove"
        cancelText="Cancel"
        onConfirm={() => {
          if (confirmDialog.isRefill) {
            deleteStockTransaction(confirmDialog.entryId);
          } else {
            deleteSale(confirmDialog.entryId);
          }
        }}
        onCancel={() => setConfirmDialog({ isOpen: false, entryId: '', isRefill: false, partyName: '', customerName: '' })}
        isDangerous={true}
      />
    </div>
  );
};

export default ProductDetail;
