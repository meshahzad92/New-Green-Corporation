import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { ShoppingCart, User, Plus, Trash2, Search, X } from 'lucide-react';
import CustomDatePicker from './CustomDatePicker';
import { formatAmount } from '../utils/formatters';

export interface AddSaleItem {
  id: string;
  companyId: string;
  search: string;
  productId: string;
  quantity: string;
  totalAmount: string;
  price: string;
}

export const createInitialSaleItem = (defaultProductId: string = '', defaultCompanyId: string = 'all'): AddSaleItem => ({
  id: Math.random().toString(36).substring(2, 9),
  companyId: defaultCompanyId,
  search: '',
  productId: defaultProductId,
  quantity: '1',
  totalAmount: '',
  price: '0'
});

interface AddSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialProductId?: string;
  initialDate?: Date | null;
}

const AddSaleModal: React.FC<AddSaleModalProps> = ({ isOpen, onClose, initialProductId, initialDate }) => {
  const { companies, products, stocks, addBulkSale } = useData();

  const [saleItems, setSaleItems] = useState<AddSaleItem[]>([createInitialSaleItem()]);
  const [addSaleCustomer, setAddSaleCustomer] = useState('');
  const [addSalePhone, setAddSalePhone] = useState('');
  const [addSalePaidAmount, setAddSalePaidAmount] = useState('');
  const [addSalePaymentType, setAddSalePaymentType] = useState<'Credit' | 'Debit'>('Debit');
  const [addSaleError, setAddSaleError] = useState('');
  const [addSaleDate, setAddSaleDate] = useState<Date>(new Date());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize or reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setAddSaleCustomer('');
      setAddSalePhone('');
      setAddSalePaidAmount('');
      setAddSalePaymentType('Debit');
      setAddSaleError('');
      // Use the pre-selected filter date if provided, otherwise default to today
      setAddSaleDate(initialDate ?? new Date());

      if (initialProductId) {
        const prod = products.find(p => p.id === initialProductId);
        const compId = prod?.companyId || 'all';
        const initialItem = createInitialSaleItem(initialProductId, compId);
        if (prod) {
          const sellingRate = prod.mrp || prod.purchasePrice || 0;
          initialItem.price = sellingRate.toString();
          initialItem.totalAmount = sellingRate.toString();
        }
        setSaleItems([initialItem]);
      } else {
        setSaleItems([createInitialSaleItem()]);
      }
    }
  }, [isOpen, initialProductId, initialDate, products]);

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

  const handleNumChange = (setter: React.Dispatch<React.SetStateAction<string>>, val: string) => {
    if (val.length > 1 && val.startsWith('0') && !val.startsWith('0.')) setter(val.slice(1));
    else setter(val);
  };

  const updateSaleItem = (id: string, updates: Partial<AddSaleItem>) => {
    setSaleItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, ...updates };

      if ('productId' in updates) {
        const prod = products.find(p => p.id === updates.productId);
        if (prod) {
          const q = parseFloat(updated.quantity) || 1;
          const sellingRate = prod.mrp || prod.purchasePrice || 0;
          updated.price = sellingRate.toString();
          updated.totalAmount = (q * sellingRate).toString();
        } else {
          updated.price = '0';
          updated.totalAmount = '';
        }
      } else if ('quantity' in updates) {
        const q = parseFloat(updated.quantity) || 0;
        const p = parseFloat(updated.price) || 0;
        updated.totalAmount = q > 0 && p > 0 ? (q * p).toString() : '';
      } else if ('totalAmount' in updates) {
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

    if (isSubmitting) return;

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

    setIsSubmitting(true);
    try {
      const success = await addBulkSale(
        addSaleCustomer.trim(),
        itemsPayload,
        finalPaymentType,
        addSalePhone.trim(),
        addSaleDate,
        effectivePaid
      );

      if (success) {
        onClose();
        setSaleItems([createInitialSaleItem()]);
        setAddSaleCustomer('');
        setAddSalePhone('');
        setAddSalePaidAmount('');
        setAddSaleError('');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

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
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
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
                        onChange={(e) => {
                          const newProdId = e.target.value;
                          const newProd = products.find(p => p.id === newProdId);
                          updateSaleItem(item.id, {
                            productId: newProdId,
                            companyId: newProd ? newProd.companyId : item.companyId
                          });
                        }}
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
                        Line Total: Rs. {formatAmount(lineTotal)}
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
                Rs. {formatAmount(currentTotal)}
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
                  {currentLeft === 0 && currentTotal > 0 ? "✅ Fully Paid (0 Left)" : `⚠️ Credit / Left: Rs. ${formatAmount(currentLeft)}`}
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
                  <p className="text-sm font-black text-slate-800 dark:text-white">Rs. {formatAmount(currentTotal)}</p>
                </div>
                <div className="p-3 bg-white dark:bg-slate-800 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase">Paid</p>
                  <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">Rs. {formatAmount(currentPaid)}</p>
                </div>
                <div className={`p-3 bg-white dark:bg-slate-800 rounded-2xl border ${currentLeft > 0 ? 'border-rose-200 dark:border-rose-900/30' : 'border-slate-100 dark:border-slate-700'}`}>
                  <p className={`text-[10px] font-bold uppercase ${currentLeft > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>Left</p>
                  <p className={`text-sm font-black ${currentLeft > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>Rs. {formatAmount(currentLeft)}</p>
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
            disabled={isSubmitting}
            className={`w-full ${addSalePaymentType === 'Debit' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'} text-white font-black py-5 rounded-2xl shadow-xl uppercase tracking-widest text-sm active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
          >
            {isSubmitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Processing Sale...
              </>
            ) : (
              `Finalize Sale (${saleItems.length} Product${saleItems.length !== 1 ? 's' : ''})`
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddSaleModal;
