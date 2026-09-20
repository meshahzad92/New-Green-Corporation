
import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { ArrowLeft, Package, ShoppingCart, Layers, Plus, TrendingUp, User, Building2, Calendar, History, Phone, CreditCard, Wallet, Banknote, X, Trash2, Edit2 } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import AddSaleModal from '../components/AddSaleModal';
import CustomDatePicker from '../components/CustomDatePicker';
import { formatDate, formatAmount } from '../utils/formatters';

const ProductDetail: React.FC = () => {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { products, stocks, sales, companies, addStock, addSale, stockTransactions, deleteSale, deleteStockTransaction, updateStockTransaction } = useData();

  const product = products.find(p => p.id === productId);
  const stock = stocks.find(s => s.productId === productId);
  const company = companies.find(c => c.id === product?.companyId);
  const productSales = sales.filter(s => s.productId === productId);
  const productLogs = stockTransactions.filter(t => t.productId === productId && t.type === 'IN');

  const combinedHistory = useMemo(() => {
    const history = [
      ...productLogs.map(l => ({ ...l, entryType: 'REFILL' as const })),
      ...productSales.map(s => ({ ...s, entryType: 'SALE' as const }))
    ];
    return history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [productLogs, productSales]);

  const totalArrivals = useMemo(() => {
    const fromLogs = productLogs.reduce((sum, l) => sum + (l.quantity || 0), 0);
    return Math.max(stock?.totalIn || 0, fromLogs);
  }, [stock?.totalIn, productLogs]);

  const totalSalesCount = useMemo(() => {
    const fromSales = productSales.reduce((sum, s) => sum + (s.quantity || 0), 0);
    return Math.max(stock?.totalOut || 0, fromSales);
  }, [stock?.totalOut, productSales]);

  const latestRefill = useMemo(() => {
    return productLogs.length > 0 ? productLogs[0] : null;
  }, [productLogs]);

  const latestCost = useMemo(() => {
    if (latestRefill && latestRefill.purchasePrice > 0) {
      return latestRefill.purchasePrice;
    }
    if (productLogs.length === 0) {
      return 0;
    }
    return product?.purchasePrice || 0;
  }, [latestRefill, productLogs, product?.purchasePrice]);

  const latestMrp = useMemo(() => {
    if (latestRefill && latestRefill.mrp !== undefined) {
      return latestRefill.mrp;
    }
    if (productLogs.length === 0) {
      return undefined;
    }
    return product?.mrp;
  }, [latestRefill, productLogs, product?.mrp]);

  const latestDiscount = useMemo(() => {
    if (latestRefill && latestRefill.companyDiscount !== undefined) {
      return latestRefill.companyDiscount;
    }
    if (productLogs.length === 0) {
      return undefined;
    }
    return product?.companyDiscount;
  }, [latestRefill, productLogs, product?.companyDiscount]);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSellModalOpen, setIsSellModalOpen] = useState(false);

  // Refill Form
  const [addQty, setAddQty] = useState('0');
  const [addParty, setAddParty] = useState('');
  const [addMrp, setAddMrp] = useState('');
  const [addDiscount, setAddDiscount] = useState('');
  const [addPurchasePrice, setAddPurchasePrice] = useState('');
  const [showDiscount, setShowDiscount] = useState(false);
  const [isSubmittingStock, setIsSubmittingStock] = useState(false);

  // Auto-calculated purchase cost when discount is applied: MRP × (1 - discount/100)
  const calculatedPurchaseCost = React.useMemo(() => {
    if (!showDiscount) return null;
    const mrp = parseFloat(addMrp);
    const disc = parseFloat(addDiscount);
    if (!isNaN(mrp) && mrp > 0 && !isNaN(disc) && disc >= 0) {
      return Number((mrp * (1 - disc / 100)).toFixed(2));
    }
    return null;
  }, [showDiscount, addMrp, addDiscount]);

  // Effective purchase price for submission
  const effectivePurchasePrice = React.useMemo(() => {
    if (showDiscount && calculatedPurchaseCost !== null) {
      return calculatedPurchaseCost;
    }
    const manual = parseFloat(addPurchasePrice);
    return !isNaN(manual) && manual >= 0 ? manual : null;
  }, [showDiscount, calculatedPurchaseCost, addPurchasePrice]);

  useEffect(() => {
    if (product && isAddModalOpen) {
      // Pre-fill with existing product mrp if available
      if (product.mrp && product.mrp > 0) setAddMrp(product.mrp.toString());
      else setAddMrp('');

      // If product already has discount > 0, activate discount mode by default
      if (product.companyDiscount !== undefined && product.companyDiscount !== null && product.companyDiscount > 0) {
        setShowDiscount(true);
        setAddDiscount(product.companyDiscount.toString());
        setAddPurchasePrice('');
      } else {
        setShowDiscount(false);
        setAddDiscount('');
        if (product.purchasePrice !== undefined && product.purchasePrice !== null && product.purchasePrice > 0) {
          setAddPurchasePrice(product.purchasePrice.toString());
        } else {
          setAddPurchasePrice('');
        }
      }
    }
  }, [product?.id, isAddModalOpen]);

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    entryId: '',
    isRefill: false,
    partyName: '',
    customerName: ''
  });

  if (!product) return null;

  const handleAddStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingStock) return;
    const q = parseInt(addQty);
    const mrp = addMrp ? parseFloat(addMrp) : undefined;
    const disc = showDiscount && addDiscount ? parseFloat(addDiscount) : undefined;
    const purchaseCost = effectivePurchasePrice;
    if (q > 0 && addParty.trim() && purchaseCost !== null) {
      setIsSubmittingStock(true);
      try {
        await addStock(product.id, q, addParty.trim(), purchaseCost, mrp, disc);
        setIsAddModalOpen(false);
        setAddQty('0');
        setAddParty('');
        setAddMrp('');
        setAddDiscount('');
        setAddPurchasePrice('');
        setShowDiscount(false);
      } catch (err) {
        console.error('Failed to refill stock:', err);
      } finally {
        setIsSubmittingStock(false);
      }
    }
  };

  const handleNumChange = (setter: React.Dispatch<React.SetStateAction<string>>, val: string) => {
    if (val.length > 1 && val.startsWith('0')) setter(val.slice(1));
    else setter(val);
  };

  // Edit Refill Modal state
  const [editRefillModal, setEditRefillModal] = useState<{
    isOpen: boolean;
    transactionId: string;
    quantity: string;
    partyName: string;
    mrp: string;
    discount: string;
    purchasePrice: string;
    showDiscount: boolean;
    date: Date;
  }>({
    isOpen: false,
    transactionId: '',
    quantity: '0',
    partyName: '',
    mrp: '',
    discount: '',
    purchasePrice: '',
    showDiscount: false,
    date: new Date(),
  });
  const [isSubmittingEditRefill, setIsSubmittingEditRefill] = useState(false);

  // Auto-calculated purchase cost for edit refill modal: MRP × (1 - discount/100)
  const calculatedEditPurchaseCost = React.useMemo(() => {
    if (!editRefillModal.showDiscount) return null;
    const mrp = parseFloat(editRefillModal.mrp);
    const disc = parseFloat(editRefillModal.discount);
    if (!isNaN(mrp) && mrp > 0 && !isNaN(disc) && disc >= 0) {
      return Number((mrp * (1 - disc / 100)).toFixed(2));
    }
    return null;
  }, [editRefillModal.showDiscount, editRefillModal.mrp, editRefillModal.discount]);

  // Effective purchase price for edit refill submission
  const effectiveEditPurchasePrice = React.useMemo(() => {
    if (editRefillModal.showDiscount && calculatedEditPurchaseCost !== null) {
      return calculatedEditPurchaseCost;
    }
    const manual = parseFloat(editRefillModal.purchasePrice);
    return !isNaN(manual) && manual >= 0 ? manual : null;
  }, [editRefillModal.showDiscount, calculatedEditPurchaseCost, editRefillModal.purchasePrice]);

  const handleSaveEditRefill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingEditRefill) return;
    const q = parseInt(editRefillModal.quantity);
    const mrp = editRefillModal.mrp ? parseFloat(editRefillModal.mrp) : null;
    const disc = editRefillModal.showDiscount && editRefillModal.discount ? parseFloat(editRefillModal.discount) : 0;
    const purchaseCost = effectiveEditPurchasePrice;

    if (q > 0 && editRefillModal.partyName.trim() && purchaseCost !== null) {
      setIsSubmittingEditRefill(true);
      try {
        await updateStockTransaction(editRefillModal.transactionId, {
          quantity: q,
          partyName: editRefillModal.partyName.trim(),
          purchasePrice: purchaseCost,
          mrp: mrp,
          companyDiscount: editRefillModal.showDiscount ? disc : 0,
          date: editRefillModal.date
        });
        setEditRefillModal(prev => ({ ...prev, isOpen: false }));
      } catch (err) {
        console.error('Failed to update stock refill:', err);
      } finally {
        setIsSubmittingEditRefill(false);
      }
    }
  };

  const inventoryValuation = (stock?.remaining || 0) * latestCost;

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
            <button onClick={() => setIsSellModalOpen(true)} className="flex-1 bg-white text-emerald-600 font-black py-4 rounded-2xl shadow-lg transition-transform hover:scale-105 active:scale-95">SELL PRODUCT</button>
            <button onClick={() => setIsAddModalOpen(true)} className="flex-1 bg-emerald-500 text-white font-black py-4 rounded-2xl shadow-lg hover:bg-emerald-400 transition-colors active:scale-95">REFILL STOCK</button>
          </div>
        </div>

        {/* Financial Position */}
        <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-700 space-y-6 flex flex-col justify-center">
          <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Stock Valuation</p>
          <h4 className="text-2xl md:text-3xl font-black text-blue-600 leading-none">Rs. {formatAmount(inventoryValuation)}</h4>
          <div className="pt-4 border-t border-slate-100 dark:border-slate-700 space-y-2">
            {latestMrp !== undefined && latestMrp > 0 && (
              <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                <span>MRP</span>
                <span className="text-slate-900 dark:text-white font-black">Rs. {formatAmount(latestMrp)}</span>
              </div>
            )}
            {latestDiscount !== undefined && latestDiscount > 0 && (
              <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                <span>Company Discount</span>
                <span className="text-emerald-600 font-black">{latestDiscount}%</span>
              </div>
            )}
            {latestCost > 0 && (
              <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                <span>Purchase Cost</span>
                <span className="text-slate-900 dark:text-white font-black">Rs. {formatAmount(latestCost)}</span>
              </div>
            )}
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
            <p className="text-2xl font-black">{totalArrivals} <span className="text-xs font-bold opacity-50 uppercase">{product.unit}</span></p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-orange-600">Total Sales</p>
            <p className="text-2xl font-black">{totalSalesCount} <span className="text-xs font-bold opacity-50 uppercase">{product.unit}</span></p>
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
                        <span className="text-sm font-bold text-slate-500">{formatDate(entry.date)}</span>
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
                      Rs. {formatAmount(isRefill ? (entry as any).purchasePrice : (entry as any).totalAmount)}
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isRefill && (
                          <button
                            onClick={() => {
                              const refill = entry as any;
                              const hasDiscount = refill.companyDiscount !== undefined && refill.companyDiscount !== null && refill.companyDiscount > 0;
                              setEditRefillModal({
                                isOpen: true,
                                transactionId: refill.id,
                                quantity: refill.quantity.toString(),
                                partyName: refill.partyName || '',
                                mrp: refill.mrp ? refill.mrp.toString() : '',
                                discount: hasDiscount ? refill.companyDiscount.toString() : '',
                                purchasePrice: (!hasDiscount && refill.purchasePrice > 0) ? refill.purchasePrice.toString() : '',
                                showDiscount: hasDiscount,
                                date: new Date(refill.date)
                              });
                            }}
                            className="p-2 text-slate-400 hover:text-emerald-600 transition-colors bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl"
                            title="Edit Refill Entry"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
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
                          title="Delete Entry"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
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
            <form onSubmit={handleAddStockSubmit} className="p-8 space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-500">Party Name (Supplier) *</label>
                <input type="text" value={addParty} onChange={(e) => setAddParty(e.target.value)} className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-emerald-500 outline-none font-bold text-slate-900 dark:text-white" placeholder="Required" required />
              </div>
              {/* Pricing Section Header with Blue Toggle */}
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
                      setAddDiscount('');
                      if (calculatedPurchaseCost !== null) {
                        setAddPurchasePrice(calculatedPurchaseCost.toString());
                      }
                    } else {
                      if (addPurchasePrice && (!addMrp || parseFloat(addMrp) === 0)) {
                        setAddMrp(addPurchasePrice);
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
                        value={addMrp}
                        onChange={(e) => setAddMrp(e.target.value)}
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
                        value={addDiscount}
                        onChange={(e) => setAddDiscount(e.target.value)}
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
                      {calculatedPurchaseCost !== null && addMrp && addDiscount && (
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">
                          Rs. {formatAmount(parseFloat(addMrp))} − {parseFloat(addDiscount)}%
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
                      value={addMrp}
                      onChange={(e) => setAddMrp(e.target.value)}
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
                      value={addPurchasePrice}
                      onChange={(e) => handleNumChange(setAddPurchasePrice, e.target.value)}
                      className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-emerald-500 outline-none font-bold text-emerald-600 dark:text-emerald-400"
                      placeholder="e.g. 900"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-500">Refill Quantity *</label>
                <input type="number" min="1" value={addQty} onChange={(e) => handleNumChange(setAddQty, e.target.value)} className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-emerald-500 outline-none font-bold text-slate-900 dark:text-white" required />
              </div>

              <button
                type="submit"
                disabled={effectivePurchasePrice === null || isSubmittingStock}
                className="w-full bg-emerald-600 text-white font-black py-4 rounded-2xl shadow-xl uppercase tracking-widest active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmittingStock ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Adding to Stock...
                  </>
                ) : (
                  'Add To Stock'
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      <AddSaleModal
        isOpen={isSellModalOpen}
        onClose={() => setIsSellModalOpen(false)}
        initialProductId={product.id}
      />

      {/* Edit Stock Refill Modal */}
      {editRefillModal.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/20 animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="bg-emerald-600 p-8 text-white flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-2xl font-black flex items-center gap-3">
                  <Edit2 className="w-6 h-6" /> Edit Refill Entry
                </h2>
                <p className="text-xs text-emerald-100 font-bold mt-1 uppercase tracking-wider">
                  {product.name} • {product.unit}
                </p>
              </div>
              <button
                onClick={() => setEditRefillModal(prev => ({ ...prev, isOpen: false }))}
                className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditRefill} className="p-8 space-y-5 overflow-y-auto flex-1">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Source / Supplier (Party Name) *
                </label>
                <input
                  type="text"
                  value={editRefillModal.partyName}
                  onChange={(e) => setEditRefillModal(prev => ({ ...prev, partyName: e.target.value }))}
                  className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-emerald-500 outline-none font-bold text-slate-900 dark:text-white"
                  placeholder="e.g. Bayer CropScience"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Refill Date
                </label>
                <CustomDatePicker
                  selected={editRefillModal.date}
                  onChange={(date) => setEditRefillModal(prev => ({ ...prev, date: date || new Date() }))}
                  placeholderText="Select refill date..."
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
                    const next = !editRefillModal.showDiscount;
                    setEditRefillModal(prev => {
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
                  {editRefillModal.showDiscount ? '− Hide Discount' : '% Discount (Optional)'}
                </button>
              </div>

              {editRefillModal.showDiscount ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">MRP (Rs.) *</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={editRefillModal.mrp}
                        onChange={(e) => setEditRefillModal(prev => ({ ...prev, mrp: e.target.value }))}
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
                        value={editRefillModal.discount}
                        onChange={(e) => setEditRefillModal(prev => ({ ...prev, discount: e.target.value }))}
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
                      {calculatedEditPurchaseCost !== null && editRefillModal.mrp && editRefillModal.discount && (
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">
                          Rs. {formatAmount(parseFloat(editRefillModal.mrp))} − {parseFloat(editRefillModal.discount)}%
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
                      value={editRefillModal.mrp}
                      onChange={(e) => setEditRefillModal(prev => ({ ...prev, mrp: e.target.value }))}
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
                      value={editRefillModal.purchasePrice}
                      onChange={(e) => {
                        const val = e.target.value;
                        const cleaned = val.length > 1 && val.startsWith('0') ? val.slice(1) : val;
                        setEditRefillModal(prev => ({ ...prev, purchasePrice: cleaned }));
                      }}
                      className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-emerald-500 outline-none font-bold text-emerald-600 dark:text-emerald-400"
                      placeholder="e.g. 900"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Refill Quantity *</label>
                <input
                  type="number"
                  min="1"
                  value={editRefillModal.quantity}
                  onChange={(e) => {
                    const val = e.target.value;
                    const cleaned = val.length > 1 && val.startsWith('0') ? val.slice(1) : val;
                    setEditRefillModal(prev => ({ ...prev, quantity: cleaned }));
                  }}
                  className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-emerald-500 outline-none font-bold text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div className="flex gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => setEditRefillModal(prev => ({ ...prev, isOpen: false }))}
                  className="flex-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-black py-4 rounded-2xl uppercase tracking-widest hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={effectiveEditPurchasePrice === null || isSubmittingEditRefill}
                  className="flex-1 bg-emerald-600 text-white font-black py-4 rounded-2xl shadow-xl uppercase tracking-widest active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmittingEditRefill ? (
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
