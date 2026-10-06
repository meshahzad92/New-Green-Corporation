import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { ShoppingCart, Plus, Trash2, Search, X, Check } from 'lucide-react';
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
  // Edit mode only: the existing sale record this row maps to
  saleId?: string;
  origProductId?: string;
  origQty?: number;
}

export interface EditSaleGroup {
  invoiceId?: string;
  invoiceNo?: string;
  customerName: string;
  customerPhone?: string;
  date: string;
  paidAmount: number;
  isDealer: boolean;
  items: Array<{
    saleId: string;
    productId: string;
    quantity: number;
    sellingPrice: number;
    totalAmount: number;
  }>;
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

const newUuid = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
};

const newInvoiceNo = (): string => {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `INV-${yy}${mm}${dd}-${Math.random().toString(16).slice(2, 6).toUpperCase()}`;
};

interface AddSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialProductId?: string;
  initialDate?: Date | null;
  editGroup?: EditSaleGroup | null;
}

const labelCls = 'text-[10px] font-black uppercase tracking-widest text-slate-400';
const inputCls = 'w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500';

const AddSaleModal: React.FC<AddSaleModalProps> = ({ isOpen, onClose, initialProductId, initialDate, editGroup }) => {
  const { companies, products, stocks, addBulkSale, addSale, updateSale, deleteSale } = useData();

  const isEdit = !!editGroup;
  const lockItems = !!editGroup?.isDealer; // dealer (khata) invoices: items can be edited but not added/removed

  const [saleItems, setSaleItems] = useState<AddSaleItem[]>([createInitialSaleItem()]);
  const [addSaleCustomer, setAddSaleCustomer] = useState('');
  const [addSalePhone, setAddSalePhone] = useState('');
  const [addSalePaidAmount, setAddSalePaidAmount] = useState('');
  const [addSalePaymentType, setAddSalePaymentType] = useState<'Credit' | 'Debit'>('Debit');
  const [addSaleError, setAddSaleError] = useState('');
  const [addSaleDate, setAddSaleDate] = useState<Date>(new Date());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize or reset when modal opens (deliberately not re-run on products refresh,
  // otherwise an in-progress edit would be wiped while saving)
  useEffect(() => {
    if (!isOpen) return;
    setAddSaleError('');

    if (editGroup) {
      setAddSaleCustomer(editGroup.customerName);
      setAddSalePhone(editGroup.customerPhone || '');
      setAddSalePaidAmount(String(editGroup.paidAmount));
      const total = editGroup.items.reduce((s, i) => s + i.totalAmount, 0);
      setAddSalePaymentType(editGroup.paidAmount >= total ? 'Debit' : 'Credit');
      setAddSaleDate(new Date(editGroup.date));
      setSaleItems(editGroup.items.map(it => {
        const prod = products.find(p => p.id === it.productId);
        return {
          id: Math.random().toString(36).substring(2, 9),
          companyId: prod?.companyId || 'all',
          search: '',
          productId: it.productId,
          quantity: String(it.quantity),
          totalAmount: String(it.totalAmount),
          price: String(it.sellingPrice),
          saleId: it.saleId,
          origProductId: it.productId,
          origQty: it.quantity
        };
      }));
      return;
    }

    setAddSaleCustomer('');
    setAddSalePhone('');
    setAddSalePaidAmount('');
    setAddSalePaymentType('Debit');
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialProductId, initialDate, editGroup]);

  const itemLineTotal = (item: AddSaleItem) => {
    const tot = parseFloat(item.totalAmount);
    if (!isNaN(tot)) return tot;
    return (parseFloat(item.quantity) || 0) * (parseFloat(item.price) || 0);
  };

  const modalGrandTotal = useMemo(() => saleItems.reduce((acc, item) => acc + itemLineTotal(item), 0), [saleItems]);

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

  const setFullPayment = () => {
    setAddSalePaidAmount(modalGrandTotal.toString());
    setAddSalePaymentType('Debit');
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
      // When editing, the quantity this sale already holds is available again
      const ownQty = item.saleId && item.origProductId === item.productId ? (item.origQty || 0) : 0;
      const available = (stock?.remaining || 0) + ownQty;
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
        saleId: item.saleId,
        productId: item.productId,
        quantity: q,
        sellingPrice: p || 0
      };
    });

    setIsSubmitting(true);
    try {
      if (editGroup) {
        const keptIds = new Set(itemsPayload.map(i => i.saleId).filter(Boolean));
        const removed = editGroup.items.filter(i => !keptIds.has(i.saleId));
        const added = itemsPayload.filter(i => !i.saleId);

        // New rows join the existing invoice; legacy single sales get an invoice id first
        let invoice: { id: string; no?: string } | undefined;
        let stampInvoice = false;
        if (editGroup.invoiceId) {
          invoice = { id: editGroup.invoiceId, no: editGroup.invoiceNo };
        } else if (added.length > 0) {
          invoice = { id: newUuid(), no: newInvoiceNo() };
          stampInvoice = true;
        }

        // 1. Free stock from removed rows
        for (const r of removed) await deleteSale(r.saleId);

        // 2. Update existing rows (paid amount is filled sequentially across rows)
        let remaining = effectivePaid;
        let ok = true;
        for (const it of itemsPayload) {
          const itemTotal = it.quantity * it.sellingPrice;
          const itemPaid = Math.min(remaining, itemTotal);
          remaining = Math.max(0, remaining - itemTotal);
          const itemType: 'Credit' | 'Debit' = itemPaid >= itemTotal ? 'Debit' : 'Credit';

          if (it.saleId) {
            const updates: Parameters<typeof updateSale>[1] = {
              productId: it.productId,
              customerName: addSaleCustomer.trim(),
              customerPhone: addSalePhone.trim(),
              quantity: it.quantity,
              sellingPrice: it.sellingPrice,
              saleDate: addSaleDate
            };
            if (!editGroup.isDealer) {
              updates.paidAmount = itemPaid;
              updates.paymentType = itemType;
            }
            if (stampInvoice && invoice) {
              updates.invoiceId = invoice.id;
              updates.invoiceNo = invoice.no;
            }
            ok = await updateSale(it.saleId, updates);
          } else {
            // 3. Brand-new rows added during the edit
            ok = await addSale(it.productId, it.quantity, addSaleCustomer.trim(), it.sellingPrice, itemType, addSalePhone.trim(), addSaleDate, itemPaid, invoice);
          }
          if (!ok) break;
        }

        if (!ok) {
          setAddSaleError('Could not save all changes. Please check stock availability and try again.');
          return;
        }
        onClose();
        return;
      }

      const success = await addBulkSale(
        addSaleCustomer.trim(),
        itemsPayload.map(({ productId, quantity, sellingPrice }) => ({ productId, quantity, sellingPrice })),
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
      <div className="bg-white dark:bg-slate-800 w-full max-w-3xl max-h-[94vh] overflow-y-auto rounded-3xl shadow-2xl border border-white/20">
        <div className="bg-blue-600 px-6 py-4 text-white flex justify-between items-center sticky top-0 z-20">
          <div>
            <h2 className="text-lg font-black">{isEdit ? 'Edit Sale' : 'Add New Sale'}</h2>
            <p className="text-[11px] text-blue-100 font-medium">
              {isEdit
                ? 'Changes update stock, profit and ledger totals'
                : 'Add one or multiple products for a customer invoice'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleAddSaleSubmit} className="p-5 space-y-4">
          {addSaleError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-xl font-bold text-xs uppercase tracking-tight border border-rose-200 dark:border-rose-900/30">
              {addSaleError}
            </div>
          )}

          {/* Customer & Invoice Details */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="space-y-1 col-span-2 sm:col-span-1">
              <label className={labelCls}>Customer Name *</label>
              <input
                type="text"
                value={addSaleCustomer}
                onChange={(e) => setAddSaleCustomer(e.target.value)}
                className={inputCls}
                placeholder="Enter customer name"
                required
              />
            </div>
            <div className="space-y-1">
              <label className={labelCls}>Phone (11 Digits)</label>
              <input
                type="tel"
                maxLength={11}
                value={addSalePhone}
                onChange={(e) => setAddSalePhone(e.target.value.replace(/\D/g, ''))}
                className={inputCls}
                placeholder="03001234567"
              />
            </div>
            <div className="space-y-1">
              <label className={labelCls}>Sale Date *</label>
              <CustomDatePicker
                selected={addSaleDate}
                onChange={(date) => setAddSaleDate(date || new Date())}
                placeholderText="Select sale date..."
                maxDate={new Date()}
              />
            </div>
          </div>

          {/* Items */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Purchased Products ({saleItems.length})
                </h3>
              </div>
              {!lockItems && (
                <button
                  type="button"
                  onClick={addSaleItemRow}
                  className="flex items-center gap-1 text-xs font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 transition-all active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Product
                </button>
              )}
            </div>

            <div className="space-y-2">
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
                const lineTotal = itemLineTotal(item);

                return (
                  <div key={item.id} className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-12 sm:col-span-3 space-y-1">
                        <label className={labelCls}>Company</label>
                        <select
                          value={item.companyId}
                          onChange={(e) => updateSaleItem(item.id, { companyId: e.target.value })}
                          className={`${inputCls} text-xs`}
                        >
                          <option value="all">🏢 All Companies</option>
                          {companies.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-12 sm:col-span-3 space-y-1">
                        <label className={labelCls}>Quick Search</label>
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Product name..."
                            value={item.search}
                            onChange={(e) => updateSaleItem(item.id, { search: e.target.value })}
                            className={`${inputCls} pl-8 text-xs`}
                          />
                        </div>
                      </div>

                      <div className="col-span-12 sm:col-span-6 space-y-1">
                        <label className={labelCls}>
                          <span className="inline-block bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300 rounded px-1.5 mr-1.5">#{idx + 1}</span>
                          Select Product *
                        </label>
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
                          className={`${inputCls} text-xs`}
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
                    </div>

                    <div className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-4 sm:col-span-2 space-y-1">
                        <label className={labelCls}>Quantity *</label>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateSaleItem(item.id, { quantity: e.target.value })}
                          className={inputCls}
                          required
                        />
                      </div>

                      <div className="col-span-8 sm:col-span-4 space-y-1">
                        <label className={labelCls}>Total Charged (Rs.) *</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={item.totalAmount}
                          onChange={(e) => updateSaleItem(item.id, { totalAmount: e.target.value })}
                          className={`${inputCls} text-blue-600 dark:text-blue-400`}
                          placeholder="e.g. 50000"
                          required
                        />
                      </div>

                      <div className="col-span-9 sm:col-span-5 text-[11px] leading-tight pb-1.5">
                        <div className="text-slate-400 font-medium">
                          Rate: <span className="font-bold text-slate-700 dark:text-slate-300">Rs. {item.price || '0'}</span> / {selectedProd?.unit || 'pack'}
                        </div>
                        <div className="font-black text-emerald-600 dark:text-emerald-400 text-xs">
                          Line Total: Rs. {formatAmount(lineTotal)}
                        </div>
                      </div>

                      <div className="col-span-3 sm:col-span-1 flex justify-end pb-0.5">
                        {saleItems.length > 1 && !lockItems && (
                          <button
                            type="button"
                            onClick={() => removeSaleItemRow(item.id)}
                            className="text-rose-500 hover:text-rose-700 p-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                            title="Remove item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Overall Invoice Payment Section */}
          <div className="bg-slate-50 dark:bg-slate-900/70 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">Grand Total Invoice:</span>
              <span className="text-xl font-black text-slate-900 dark:text-white">
                Rs. {formatAmount(currentTotal)}
                <span className="text-xs text-slate-400 font-bold ml-2">({modalGrandQty} items)</span>
              </span>
            </div>

            {lockItems ? (
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                Dealer credit sale — payments are tracked in the Dealer Khata. Product, quantity and rate changes sync to the ledger.
              </p>
            ) : (
              <>
                <div className="space-y-1">
                  <label className={labelCls}>Amount Paid by Customer (Rs.) *</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={addSalePaidAmount}
                      onChange={(e) => handlePaidAmountChange(e.target.value)}
                      className="flex-1 min-w-0 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-blue-500 outline-none font-black text-emerald-600 text-lg"
                      placeholder="Enter amount paid"
                      required
                    />
                    <button
                      type="button"
                      onClick={setFullPayment}
                      className="shrink-0 flex items-center gap-1.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
                    >
                      <Check className="w-4 h-4 stroke-[3px]" />
                      Full Payment
                    </button>
                  </div>
                </div>

                {/* Visual Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[11px] font-black uppercase tracking-wider">
                    <span className="text-slate-400">Payment Status:</span>
                    <span className={currentLeft === 0 && currentTotal > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>
                      {currentLeft === 0 && currentTotal > 0 ? "✅ Fully Paid (0 Left)" : `⚠️ Credit / Left: Rs. ${formatAmount(currentLeft)}`}
                    </span>
                  </div>

                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden flex">
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
                    <div className="py-1.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                      <p className="text-[9px] text-slate-400 font-bold uppercase">Total Bill</p>
                      <p className="text-sm font-black text-slate-800 dark:text-white">Rs. {formatAmount(currentTotal)}</p>
                    </div>
                    <div className="py-1.5 bg-white dark:bg-slate-800 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                      <p className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold uppercase">Paid</p>
                      <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">Rs. {formatAmount(currentPaid)}</p>
                    </div>
                    <div className={`py-1.5 bg-white dark:bg-slate-800 rounded-xl border ${currentLeft > 0 ? 'border-rose-200 dark:border-rose-900/30' : 'border-slate-100 dark:border-slate-700'}`}>
                      <p className={`text-[9px] font-bold uppercase ${currentLeft > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>Left</p>
                      <p className={`text-sm font-black ${currentLeft > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>Rs. {formatAmount(currentLeft)}</p>
                    </div>
                  </div>
                </div>

                {/* Payment Type Selection */}
                <div className="flex bg-slate-200 dark:bg-slate-900 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setAddSalePaymentType('Debit')}
                    className={`flex-1 py-2 rounded-lg font-black text-[11px] uppercase tracking-widest transition-all ${addSalePaymentType === 'Debit' ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' : 'text-slate-400'}`}
                  >
                    Debit (Paid)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddSalePaymentType('Credit')}
                    className={`flex-1 py-2 rounded-lg font-black text-[11px] uppercase tracking-widest transition-all ${addSalePaymentType === 'Credit' ? 'bg-white dark:bg-slate-700 text-rose-600 shadow-sm' : 'text-slate-400'}`}
                  >
                    Credit (Pending)
                  </button>
                </div>
              </>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full ${addSalePaymentType === 'Debit' || lockItems ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'} text-white font-black py-3.5 rounded-xl shadow-lg uppercase tracking-widest text-sm active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
          >
            {isSubmitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {isEdit ? 'Saving Changes...' : 'Processing Sale...'}
              </>
            ) : isEdit ? (
              `Save Changes (${saleItems.length} Product${saleItems.length !== 1 ? 's' : ''})`
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
