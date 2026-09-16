
import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { Layers, Plus, Search, AlertCircle, ArrowUpRight, X, History, ClipboardList, Building2, Trash2, Eye, EyeOff, TrendingUp, Edit2 } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import CustomDatePicker from '../components/CustomDatePicker';

const StockPage: React.FC = () => {
  const { products, stocks, stockTransactions, companies, addStock, deleteStockTransaction, updateStockTransaction } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<string>('all');
  const [showLowStock, setShowLowStock] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'balance' | 'logs'>('balance');
  const [specificDate, setSpecificDate] = useState<Date | null>(null); // Use Date object

  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState<string>('');
  const [partyName, setPartyName] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [mrp, setMrp] = useState('');
  const [discount, setDiscount] = useState('');
  const [showDiscount, setShowDiscount] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-calculated purchase cost when discount is applied: MRP × (1 - discount/100)
  const calculatedPurchaseCost = React.useMemo(() => {
    if (!showDiscount) return null;
    const m = parseFloat(mrp);
    const d = parseFloat(discount);
    if (!isNaN(m) && m > 0 && !isNaN(d) && d >= 0) {
      return Number((m * (1 - d / 100)).toFixed(2));
    }
    return null;
  }, [showDiscount, mrp, discount]);

  // Effective purchase price for submission
  const effectivePurchasePrice = React.useMemo(() => {
    if (showDiscount && calculatedPurchaseCost !== null) {
      return calculatedPurchaseCost;
    }
    const manual = parseFloat(purchasePrice);
    return !isNaN(manual) && manual >= 0 ? manual : null;
  }, [showDiscount, calculatedPurchaseCost, purchasePrice]);

  // Banking-style amount visibility toggle (hidden by default)
  const [amountsVisible, setAmountsVisible] = useState(false);
  const maskAmount = (value: string | number) =>
    amountsVisible ? value : '••••••';

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    transactionId: '',
    productName: '',
    partyName: ''
  });

  // Edit Inward Modal state
  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    transactionId: string;
    productName: string;
    unit: string;
    partyName: string;
    quantity: string;
    mrp: string;
    discount: string;
    purchasePrice: string;
    showDiscount: boolean;
    date: Date;
  }>({
    isOpen: false,
    transactionId: '',
    productName: '',
    unit: '',
    partyName: '',
    quantity: '',
    mrp: '',
    discount: '',
    purchasePrice: '',
    showDiscount: false,
    date: new Date(),
  });
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Auto-calculated purchase cost for edit modal: MRP × (1 - discount/100)
  const calculatedEditPurchaseCost = React.useMemo(() => {
    if (!editModal.showDiscount) return null;
    const m = parseFloat(editModal.mrp);
    const d = parseFloat(editModal.discount);
    if (!isNaN(m) && m > 0 && !isNaN(d) && d >= 0) {
      return Number((m * (1 - d / 100)).toFixed(2));
    }
    return null;
  }, [editModal.showDiscount, editModal.mrp, editModal.discount]);

  // Effective purchase price for edit submission
  const effectiveEditPurchasePrice = React.useMemo(() => {
    if (editModal.showDiscount && calculatedEditPurchaseCost !== null) {
      return calculatedEditPurchaseCost;
    }
    const manual = parseFloat(editModal.purchasePrice);
    return !isNaN(manual) && manual >= 0 ? manual : null;
  }, [editModal.showDiscount, calculatedEditPurchaseCost, editModal.purchasePrice]);

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingEdit) return;
    const q = parseInt(editModal.quantity);
    const m = editModal.mrp ? parseFloat(editModal.mrp) : null;
    const d = editModal.showDiscount && editModal.discount ? parseFloat(editModal.discount) : 0;
    const cost = effectiveEditPurchasePrice;

    if (q > 0 && editModal.partyName.trim() && cost !== null) {
      setIsSubmittingEdit(true);
      try {
        await updateStockTransaction(editModal.transactionId, {
          quantity: q,
          partyName: editModal.partyName.trim(),
          purchasePrice: cost,
          mrp: m,
          companyDiscount: editModal.showDiscount ? d : 0,
          date: editModal.date
        });
        setEditModal(prev => ({ ...prev, isOpen: false }));
      } catch (err) {
        console.error('Failed to update stock entry:', err);
      } finally {
        setIsSubmittingEdit(false);
      }
    }
  };

  // Deduplicate products: ensure only 1 product of same name and same company exists in display, prioritizing records with active stock
  const uniqueProducts = React.useMemo(() => {
    const grouped = new Map<string, typeof products>();
    for (const p of products) {
      const key = `${p.companyId || 'nocomp'}-${p.name.trim().toLowerCase()}`;
      const list = grouped.get(key) || [];
      list.push(p);
      grouped.set(key, list);
    }

    const result: typeof products = [];
    grouped.forEach((list) => {
      if (list.length === 1) {
        result.push(list[0]);
      } else {
        const sorted = [...list].sort((a, b) => {
          const stockA = stocks.find(s => s.productId === a.id)?.remaining || 0;
          const stockB = stocks.find(s => s.productId === b.id)?.remaining || 0;
          if (stockB !== stockA) return stockB - stockA;
          const priceA = a.purchasePrice || 0;
          const priceB = b.purchasePrice || 0;
          return priceB - priceA;
        });
        result.push(sorted[0]);
      }
    });

    return result.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }, [products, stocks]);

  const filteredProducts = uniqueProducts.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCompany = selectedCompany === 'all' || p.companyId === selectedCompany;
    const stock = stocks.find(s => s.productId === p.id);
    const matchesLowStock = !showLowStock || (stock?.remaining || 0) < (p.minStock || 5);
    return matchesSearch && matchesCompany && matchesLowStock;
  });

  // Stock Valuation Summary: calculates total capital investment (at purchase cost), retail return (at MRP), and profit potential
  const stockSummary = React.useMemo(() => {
    let totalItems = 0;
    let totalCost = 0;
    let totalMrp = 0;

    for (const prod of filteredProducts) {
      const st = stocks.find(s => s.productId === prod.id);
      const remaining = st?.remaining || 0;
      if (remaining > 0) {
        totalItems += remaining;
        const cost = prod.purchasePrice || 0;
        const mrp = prod.mrp && prod.mrp > 0 ? prod.mrp : cost;
        totalCost += cost * remaining;
        totalMrp += mrp * remaining;
      }
    }

    const profit = totalMrp - totalCost;
    const marginPct = totalCost > 0 ? ((profit / totalCost) * 100).toFixed(1) : '0';

    return { totalItems, totalCost, totalMrp, profit, marginPct };
  }, [filteredProducts, stocks]);

  const filteredLogs = stockTransactions.filter(t => {
    if (t.type !== 'IN') return false; // Show only added logs

    const product = products.find(prod => prod.id === t.productId);
    const matchesSearch = product?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.partyName.toLowerCase().includes(searchTerm.toLowerCase());

    const logDate = new Date(t.date);

    if (specificDate) {
      return logDate.toDateString() === specificDate.toDateString();
    }

    return matchesSearch;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    const qty = parseInt(quantity);
    const cost = effectivePurchasePrice;
    if (!selectedProductId || !qty || qty <= 0 || cost === null) return;

    const mrpVal = mrp ? parseFloat(mrp) : undefined;
    const discVal = showDiscount && discount ? parseFloat(discount) : undefined;

    setIsSubmitting(true);
    try {
      await addStock(selectedProductId, qty, partyName.trim() || 'Direct Supply', cost, mrpVal, discVal);
      setIsModalOpen(false);
      setSelectedProductId('');
      setQuantity('');
      setPartyName('');
      setPurchasePrice('');
      setMrp('');
      setDiscount('');
      setShowDiscount(false);
    } catch (err) {
      console.error('Failed to log stock:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNumChange = (setter: React.Dispatch<React.SetStateAction<string>>, val: string) => {
    if (val.length > 1 && val.startsWith('0')) setter(val.slice(1));
    else setter(val);
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Inventory Ledger</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Track supplier arrivals and current balances</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-2xl flex items-center gap-3 font-bold shadow-xl shadow-emerald-600/20 transition-all active:scale-95"
        >
          <Plus className="w-5 h-5 stroke-[3px]" />
          STOCK INWARD
        </button>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-4">
        <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 w-full md:w-fit">
          <button
            onClick={() => setActiveTab('balance')}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'balance' ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <ClipboardList className="w-4 h-4" />
            Balance
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'logs' ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <History className="w-4 h-4" />
            Stock In Logs
          </button>
        </div>

        {activeTab === 'balance' ? (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                value={selectedCompany}
                onChange={(e) => { setSelectedCompany(e.target.value); }}
                className="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500 min-w-[160px]"
              >
                <option value="all">🏢 All Companies</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setShowLowStock(prev => !prev)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all border ${
                showLowStock
                  ? 'bg-rose-600 text-white border-rose-600 shadow-lg shadow-rose-600/20'
                  : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-rose-400 hover:text-rose-500'
              }`}
            >
              <AlertCircle className="w-4 h-4" />
              Low Stock
              {showLowStock && selectedCompany !== 'all' && (
                <span className="text-[10px] font-black bg-white/20 px-1.5 py-0.5 rounded-md">
                  {companies.find(c => c.id === selectedCompany)?.name}
                </span>
              )}
            </button>

            {(selectedCompany !== 'all' || showLowStock) && (
              <button
                onClick={() => { setSelectedCompany('all'); setShowLowStock(false); }}
                className="text-[10px] font-black text-slate-400 hover:text-rose-500 transition-colors uppercase tracking-widest"
              >
                ✕ Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            {/* Quick Day Buttons */}
            <div className="flex bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl gap-1">
              <button
                onClick={() => setSpecificDate(new Date())}
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
                }}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${specificDate && specificDate.toDateString() === new Date(new Date().setDate(new Date().getDate() - 1)).toDateString()
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-blue-600'
                  }`}
              >
                ⏮️ Yesterday
              </button>
              <button
                onClick={() => setSpecificDate(null)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${!specificDate ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600' : 'text-slate-400'
                  }`}
              >
                All Logs
              </button>
            </div>

            {/* Custom Date Picker */}
            <div className="w-48">
              <CustomDatePicker
                selected={specificDate}
                onChange={(date) => setSpecificDate(date)}
                placeholderText="Pick a date..."
                maxDate={new Date()}
              />
            </div>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-6 shadow-sm border border-slate-200/60 dark:border-slate-700">
        <div className="relative mb-8 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder={`Search ${activeTab === 'balance' ? 'products' : 'suppliers'}...`}
              className="w-full pl-14 pr-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-none outline-none font-bold text-slate-900 dark:text-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {/* Banking-style hide/show amounts toggle */}
          <button
            onClick={() => setAmountsVisible(prev => !prev)}
            title={amountsVisible ? 'Hide amounts' : 'Show amounts'}
            className={`flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center transition-all border font-bold shadow-sm ${
              amountsVisible
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-emerald-600/20'
                : 'bg-slate-50 dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-700 hover:border-emerald-400 hover:text-emerald-500'
            }`}
          >
            {amountsVisible ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
          </button>
        </div>

        {activeTab === 'balance' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-gradient-to-br from-blue-50 to-white dark:from-slate-900 dark:to-slate-800/60 p-5 rounded-3xl border border-blue-100 dark:border-blue-900/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">Total Investment</span>
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">Purchase Cost</span>
              </div>
              <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-2">
                Rs. {maskAmount(stockSummary.totalCost.toLocaleString())}
              </p>
              <p className="text-[11px] text-slate-400 font-medium mt-1">Capital invested across {stockSummary.totalItems.toLocaleString()} units</p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-white dark:from-slate-900 dark:to-slate-800/60 p-5 rounded-3xl border border-purple-100 dark:border-purple-900/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-purple-600 dark:text-purple-400">Projected Return</span>
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300">Retail MRP</span>
              </div>
              <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-2">
                Rs. {maskAmount(stockSummary.totalMrp.toLocaleString())}
              </p>
              <p className="text-[11px] text-slate-400 font-medium mt-1">Total revenue if all sold at printed MRP</p>
            </div>

            <div className="bg-gradient-to-br from-emerald-50 to-white dark:from-slate-900 dark:to-slate-800/60 p-5 rounded-3xl border border-emerald-100 dark:border-emerald-900/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Expected Profit</span>
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">+{stockSummary.marginPct}% Margin</span>
              </div>
              <p className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
                {amountsVisible ? `+Rs. ${stockSummary.profit.toLocaleString()}` : 'Rs. ••••••'}
              </p>
              <p className="text-[11px] text-slate-400 font-medium mt-1">Gross profit margin if sold at MRP</p>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          {activeTab === 'balance' ? (
            <table className="w-full text-left">
              <thead className="text-[10px] uppercase text-slate-400 font-black tracking-widest border-b border-slate-100 dark:border-slate-700">
                <tr>
                  <th className="px-6 py-5">Product Details</th>
                  <th className="px-6 py-5">In Stock</th>
                  <th className="px-6 py-5">Purchase Price</th>
                  <th className="px-6 py-5">Retail (MRP)</th>
                  <th className="px-6 py-5">Total Investment</th>
                  <th className="px-6 py-5">Value at MRP</th>
                  <th className="px-6 py-5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filteredProducts.map((product) => {
                  const stock = stocks.find(s => s.productId === product.id);
                  const remaining = stock?.remaining || 0;
                  const isCritical = remaining < (product.minStock || 5);
                  const cost = product.purchasePrice || 0;
                  const mrp = product.mrp && product.mrp > 0 ? product.mrp : cost;
                  const totalCost = cost * remaining;
                  const totalMrp = mrp * remaining;
                  const diff = totalMrp - totalCost;

                  return (
                    <tr key={product.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                      <td className="px-6 py-5">
                        <p className="font-bold text-slate-900 dark:text-white text-base">{product.name}</p>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-tight mt-0.5">{product.unit}</p>
                      </td>
                      <td className="px-6 py-5">
                        <span className={`font-black text-xl ${isCritical ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {remaining.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <p className="font-bold text-slate-900 dark:text-white text-sm">
                          Rs. {maskAmount(cost.toLocaleString())}
                        </p>
                        {product.companyDiscount && product.companyDiscount > 0 ? (
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
                            {product.companyDiscount}% off
                          </span>
                        ) : null}
                      </td>
                      <td className="px-6 py-5">
                        <p className="font-bold text-purple-600 dark:text-purple-400 text-sm">
                          Rs. {maskAmount(mrp.toLocaleString())}
                        </p>
                      </td>
                      <td className="px-6 py-5">
                        <p className="font-black text-blue-600 dark:text-blue-400 text-sm">
                          Rs. {maskAmount(totalCost.toLocaleString())}
                        </p>
                        <p className="text-[10px] text-slate-400 font-semibold">Invested capital</p>
                      </td>
                      <td className="px-6 py-5">
                        <p className="font-black text-slate-900 dark:text-white text-sm">
                          Rs. {maskAmount(totalMrp.toLocaleString())}
                        </p>
                        {diff > 0 && remaining > 0 && amountsVisible ? (
                          <p className="text-[10px] text-emerald-600 font-bold">
                            +{diff.toLocaleString()} profit
                          </p>
                        ) : null}
                      </td>
                      <td className="px-6 py-5 text-right">
                        {isCritical ? (
                          <div className="inline-flex items-center gap-1.5 text-rose-600 bg-rose-50 dark:bg-rose-900/10 px-3 py-1 rounded-full text-[10px] font-black border border-rose-100 dark:border-rose-800/20">
                            <AlertCircle className="w-3.5 h-3.5" />
                            CRITICAL
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/10 px-3 py-1 rounded-full text-[10px] font-black border border-emerald-100 dark:border-emerald-800/20">
                            <ArrowUpRight className="w-3.5 h-3.5" />
                            NORMAL
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left">
              <thead className="text-[10px] uppercase text-slate-400 font-black tracking-widest border-b border-slate-100 dark:border-slate-700">
                <tr>
                  <th className="px-8 py-6">Date</th>
                  <th className="px-8 py-6">Source (Party)</th>
                  <th className="px-8 py-6">Item Name</th>
                  <th className="px-8 py-6">Qty Added</th>
                  <th className="px-8 py-6">Inward Cost</th>
                  <th className="px-8 py-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filteredLogs.map((transaction) => {
                  const product = products.find(p => p.id === transaction.productId);
                  return (
                    <tr key={transaction.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                      <td className="px-8 py-6 text-slate-500 dark:text-slate-400 font-bold text-sm">
                        {new Date(transaction.date).toLocaleDateString()}
                      </td>
                      <td className="px-8 py-6">
                        <span className="font-black text-slate-900 dark:text-white flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 text-emerald-500" />
                          {transaction.partyName}
                        </span>
                      </td>
                      <td className="px-8 py-6 font-bold text-slate-600 dark:text-slate-300">
                        {product?.name || 'Unknown'}
                      </td>
                      <td className="px-8 py-6">
                        <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-3 py-1 rounded-lg font-black text-sm">
                          + {transaction.quantity}
                        </span>
                      </td>
                      <td className="px-8 py-6 italic font-black text-slate-900 dark:text-white">
                        Rs. {maskAmount(transaction.purchasePrice.toLocaleString())}
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              const product = products.find(p => p.id === transaction.productId);
                              const hasDiscount = transaction.companyDiscount !== undefined && transaction.companyDiscount !== null && transaction.companyDiscount > 0;
                              setEditModal({
                                isOpen: true,
                                transactionId: transaction.id,
                                productName: product?.name || 'Unknown',
                                unit: product?.unit || 'Units',
                                partyName: transaction.partyName || '',
                                quantity: transaction.quantity.toString(),
                                mrp: transaction.mrp ? transaction.mrp.toString() : '',
                                discount: hasDiscount ? transaction.companyDiscount!.toString() : '',
                                purchasePrice: (!hasDiscount && transaction.purchasePrice > 0) ? transaction.purchasePrice.toString() : '',
                                showDiscount: hasDiscount,
                                date: new Date(transaction.date)
                              });
                            }}
                            className="p-2 text-slate-400 hover:text-emerald-600 transition-colors bg-slate-50 dark:bg-slate-800 rounded-lg"
                            title="Edit Stock Entry"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              const product = products.find(p => p.id === transaction.productId);
                              setConfirmDialog({
                                isOpen: true,
                                transactionId: transaction.id,
                                productName: product?.name || 'Unknown',
                                partyName: transaction.partyName
                              });
                            }}
                            className="p-2 text-slate-400 hover:text-rose-500 transition-colors bg-slate-50 dark:bg-slate-800 rounded-lg"
                            title="Delete Stock Entry"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {filteredProducts.length === 0 && (
            <div className="py-24 text-center text-slate-400">
              <Layers className="w-16 h-16 mx-auto mb-4 opacity-10" />
              <p className="text-lg font-bold">No results found.</p>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/20">
            <div className="bg-emerald-600 p-8 text-white flex items-center justify-between">
              <h2 className="text-2xl font-black flex items-center gap-3">
                <Layers className="w-6 h-6" /> Stock Inward
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddStock} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-500">Party Name (Source)</label>
                <input
                  type="text"
                  value={partyName}
                  onChange={(e) => setPartyName(e.target.value)}
                  className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-emerald-500 outline-none font-bold text-slate-900 dark:text-white"
                  placeholder="Supplier/Party name..."
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-500">Select Item</label>
                <select
                  value={selectedProductId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedProductId(id);
                    const prod = uniqueProducts.find(p => p.id === id);
                    if (prod) {
                      if (prod.mrp && prod.mrp > 0) setMrp(prod.mrp.toString());
                      else setMrp('');

                      if (prod.companyDiscount && prod.companyDiscount > 0) {
                        setShowDiscount(true);
                        setDiscount(prod.companyDiscount.toString());
                        setPurchasePrice('');
                      } else {
                        setShowDiscount(false);
                        setDiscount('');
                        if (prod.purchasePrice && prod.purchasePrice > 0) {
                          setPurchasePrice(prod.purchasePrice.toString());
                        } else {
                          setPurchasePrice('');
                        }
                      }
                    }
                  }}
                  className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-emerald-500 outline-none font-bold text-slate-900 dark:text-white appearance-none"
                  required
                >
                  <option value="">Choose item...</option>
                  {uniqueProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-500">Qty *</label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => handleNumChange(setQuantity, e.target.value)}
                  className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-emerald-500 outline-none font-bold text-slate-900 dark:text-white"
                  placeholder="Quantity to add..."
                  required
                />
              </div>

              {/* Pricing Section Header with Blue Toggle Link */}
              <div className="flex items-center justify-between pt-1">
                <label className="text-xs font-black uppercase tracking-widest text-slate-500">
                  Pricing Details
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const next = !showDiscount;
                    setShowDiscount(next);
                    if (!next) {
                      setDiscount('');
                      if (calculatedPurchaseCost !== null) {
                        setPurchasePrice(calculatedPurchaseCost.toString());
                      }
                    } else {
                      if (purchasePrice && (!mrp || parseFloat(mrp) === 0)) {
                        setMrp(purchasePrice);
                      }
                    }
                  }}
                  className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline flex items-center gap-1 transition-colors cursor-pointer"
                >
                  {showDiscount ? '− Hide Discount' : '% Discount (Optional)'}
                </button>
              </div>

              {showDiscount ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-500">MRP (Rs.) *</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={mrp}
                        onChange={(e) => setMrp(e.target.value)}
                        className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-emerald-500 outline-none font-bold text-slate-900 dark:text-white"
                        placeholder="e.g. 1000"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 flex items-center justify-between">
                        <span>Discount % *</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="any"
                        value={discount}
                        onChange={(e) => setDiscount(e.target.value)}
                        className="w-full px-6 py-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border-2 border-blue-200 dark:border-blue-800 focus:border-blue-500 outline-none font-bold text-blue-600 dark:text-blue-400"
                        placeholder="e.g. 10"
                        required
                      />
                    </div>
                  </div>

                  {/* Auto-calculated Purchase Cost */}
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl p-5 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                          Purchase Cost (Auto-calculated)
                        </p>
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200 font-bold">
                          Auto
                        </span>
                      </div>
                      <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-1">
                        {calculatedPurchaseCost !== null ? `Rs. ${calculatedPurchaseCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                      </p>
                      {calculatedPurchaseCost !== null && mrp && discount && (
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">
                          Rs. {parseFloat(mrp).toLocaleString()} − {parseFloat(discount)}%
                        </p>
                      )}
                    </div>
                    <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-800 rounded-2xl flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-emerald-600 dark:text-emerald-300" />
                    </div>
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-500">MRP (Rs.)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={mrp}
                      onChange={(e) => setMrp(e.target.value)}
                      className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-emerald-500 outline-none font-bold text-slate-900 dark:text-white"
                      placeholder="e.g. 1000"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Purchase Price *</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={purchasePrice}
                      onChange={(e) => handleNumChange(setPurchasePrice, e.target.value)}
                      className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-emerald-500 outline-none font-bold text-emerald-600 dark:text-emerald-400"
                      placeholder="e.g. 900"
                      required
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !selectedProductId || !parseInt(quantity) || effectivePurchasePrice === null}
                className="w-full bg-emerald-600 text-white font-black py-5 rounded-2xl hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-600/30 uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving Log...
                  </>
                ) : (
                  'Save Log'
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Stock Inward Modal */}
      {editModal.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/20 animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="bg-emerald-600 p-8 text-white flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-2xl font-black flex items-center gap-3">
                  <Edit2 className="w-6 h-6" /> Edit Stock Entry
                </h2>
                <p className="text-xs text-emerald-100 font-bold mt-1 uppercase tracking-wider">
                  {editModal.productName} • {editModal.unit}
                </p>
              </div>
              <button onClick={() => setEditModal(prev => ({ ...prev, isOpen: false }))} className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-8 space-y-5 overflow-y-auto flex-1">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Party Name (Source) *</label>
                <input
                  type="text"
                  value={editModal.partyName}
                  onChange={(e) => setEditModal(prev => ({ ...prev, partyName: e.target.value }))}
                  className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-emerald-500 outline-none font-bold text-slate-900 dark:text-white"
                  placeholder="Supplier/Party name..."
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Inward Date</label>
                <CustomDatePicker
                  selected={editModal.date}
                  onChange={(date) => setEditModal(prev => ({ ...prev, date: date || new Date() }))}
                  placeholderText="Select inward date..."
                  maxDate={new Date()}
                />
              </div>

              {/* Pricing Section Header with Blue Toggle */}
              <div className="flex items-center justify-between pt-1">
                <label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Pricing Details
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const next = !editModal.showDiscount;
                    setEditModal(prev => {
                      if (!next) {
                        return {
                          ...prev,
                          showDiscount: false,
                          discount: '',
                          purchasePrice: calculatedEditPurchaseCost !== null ? calculatedEditPurchaseCost.toString() : prev.purchasePrice
                        };
                      } else {
                        return {
                          ...prev,
                          showDiscount: true,
                          mrp: (!prev.mrp || parseFloat(prev.mrp) === 0) && prev.purchasePrice ? prev.purchasePrice : prev.mrp
                        };
                      }
                    });
                  }}
                  className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline flex items-center gap-1 transition-colors cursor-pointer"
                >
                  {editModal.showDiscount ? '− Hide Discount' : '% Discount (Optional)'}
                </button>
              </div>

              {editModal.showDiscount ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">MRP (Rs.) *</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={editModal.mrp}
                        onChange={(e) => setEditModal(prev => ({ ...prev, mrp: e.target.value }))}
                        className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-emerald-500 outline-none font-bold text-slate-900 dark:text-white"
                        placeholder="e.g. 1000"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">
                        Discount % *
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="any"
                        value={editModal.discount}
                        onChange={(e) => setEditModal(prev => ({ ...prev, discount: e.target.value }))}
                        className="w-full px-6 py-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border-2 border-blue-200 dark:border-blue-800 focus:border-blue-500 outline-none font-bold text-blue-600 dark:text-blue-400"
                        placeholder="e.g. 10"
                        required
                      />
                    </div>
                  </div>

                  {/* Auto-calculated Purchase Cost */}
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl p-5 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                          Purchase Cost (Auto-calculated)
                        </p>
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200 font-bold">
                          Auto
                        </span>
                      </div>
                      <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-1">
                        {calculatedEditPurchaseCost !== null ? `Rs. ${calculatedEditPurchaseCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                      </p>
                      {calculatedEditPurchaseCost !== null && editModal.mrp && editModal.discount && (
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">
                          Rs. {parseFloat(editModal.mrp).toLocaleString()} − {parseFloat(editModal.discount)}%
                        </p>
                      )}
                    </div>
                    <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-800 rounded-2xl flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-emerald-600 dark:text-emerald-300" />
                    </div>
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">MRP (Rs.)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={editModal.mrp}
                      onChange={(e) => setEditModal(prev => ({ ...prev, mrp: e.target.value }))}
                      className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-emerald-500 outline-none font-bold text-slate-900 dark:text-white"
                      placeholder="e.g. 1000"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Purchase Price *</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={editModal.purchasePrice}
                      onChange={(e) => {
                        const val = e.target.value;
                        const cleaned = val.length > 1 && val.startsWith('0') ? val.slice(1) : val;
                        setEditModal(prev => ({ ...prev, purchasePrice: cleaned }));
                      }}
                      className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-emerald-500 outline-none font-bold text-emerald-600 dark:text-emerald-400"
                      placeholder="e.g. 900"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Quantity Added *</label>
                <input
                  type="number"
                  min="1"
                  value={editModal.quantity}
                  onChange={(e) => {
                    const val = e.target.value;
                    const cleaned = val.length > 1 && val.startsWith('0') ? val.slice(1) : val;
                    setEditModal(prev => ({ ...prev, quantity: cleaned }));
                  }}
                  className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-emerald-500 outline-none font-bold text-slate-900 dark:text-white"
                  placeholder="1"
                  required
                />
              </div>

              <div className="flex gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => setEditModal(prev => ({ ...prev, isOpen: false }))}
                  className="flex-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-black py-4 rounded-2xl uppercase tracking-widest hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit || !parseInt(editModal.quantity) || effectiveEditPurchasePrice === null}
                  className="flex-1 bg-emerald-600 text-white font-black py-4 rounded-2xl shadow-xl uppercase tracking-widest active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmittingEdit ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title="Remove Stock Entry"
        message={`Are you sure you want to remove this stock entry for "${confirmDialog.productName}" from "${confirmDialog.partyName}"? This will adjust the inventory accordingly.`}
        confirmText="Yes, Remove"
        cancelText="Cancel"
        onConfirm={() => deleteStockTransaction(confirmDialog.transactionId)}
        onCancel={() => setConfirmDialog({ isOpen: false, transactionId: '', productName: '', partyName: '' })}
        isDangerous={true}
      />
    </div>
  );
};

export default StockPage;
