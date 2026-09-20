import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { khataService, KhataAccount } from '../utils/khataApi';
import CustomDatePicker from './CustomDatePicker';
import { 
  CreditCard, 
  Wallet, 
  User, 
  Plus, 
  Trash2, 
  Search, 
  X, 
  Check, 
  Loader2, 
  AlertCircle,
  Package,
  UserPlus,
  Banknote,
  Landmark
} from 'lucide-react';
import { formatAmount } from '../utils/formatters';

interface CreditSaleItem {
  id: string;
  companyId: string;
  search: string;
  productId: string;
  quantity: string;
  price: string;
  total: string;
}

const createInitialItem = (): CreditSaleItem => ({
  id: Math.random().toString(36).substring(2, 9),
  companyId: 'all',
  search: '',
  productId: '',
  quantity: '1',
  price: '0',
  total: '0'
});

interface CreditSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDealerId?: string;
  initialDate?: Date | null;
  defaultMode?: 'credit' | 'recovery';
}

const CreditSaleModal: React.FC<CreditSaleModalProps> = ({
  isOpen,
  onClose,
  initialDealerId,
  initialDate,
  defaultMode = 'credit'
}) => {
  const { products, stocks, companies, refreshData } = useData();

  const [activeTab, setActiveTab] = useState<'credit' | 'recovery'>(defaultMode);
  const [dealers, setDealers] = useState<KhataAccount[]>([]);
  const [selectedDealerId, setSelectedDealerId] = useState<string>('');
  const [farmerName, setFarmerName] = useState('');
  const [entryDate, setEntryDate] = useState<Date>(new Date());
  const [remarks, setRemarks] = useState('');
  
  // Credit Sale line items
  const [items, setItems] = useState<CreditSaleItem[]>([createInitialItem()]);

  // Recovery fields
  const [recoveryAmount, setRecoveryAmount] = useState('');
  const [recoveryMethod, setRecoveryMethod] = useState<'CASH' | 'ONLINE'>('CASH');
  const [recoveryBank, setRecoveryBank] = useState('');

  // Inline Add New Dealer state
  const [showAddDealer, setShowAddDealer] = useState(false);
  const [newDealerName, setNewDealerName] = useState('');
  const [newDealerPhone, setNewDealerPhone] = useState('');
  const [isSavingDealer, setIsSavingDealer] = useState(false);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Fetch dealers list whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultMode);
      setEntryDate(initialDate ?? new Date());
      setSelectedDealerId(initialDealerId || '');
      setFarmerName('');
      setRemarks('');
      setRecoveryAmount('');
      setRecoveryMethod('CASH');
      setRecoveryBank('');
      setItems([createInitialItem()]);
      setErrorMessage('');
      setShowAddDealer(false);
      setNewDealerName('');
      setNewDealerPhone('');

      loadDealers();
    }
  }, [isOpen, initialDealerId, initialDate, defaultMode]);

  const loadDealers = async () => {
    try {
      const data = await khataService.getDealers();
      setDealers(data);
      if (initialDealerId) {
        setSelectedDealerId(initialDealerId);
      } else if (data.length > 0 && !selectedDealerId) {
        setSelectedDealerId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load dealers:', err);
    }
  };

  const handleQuickAddDealer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDealerName.trim() || isSavingDealer) return;

    setIsSavingDealer(true);
    try {
      const newD = await khataService.createDealer({
        name: newDealerName.trim(),
        phone: newDealerPhone.trim() || undefined,
        role: 'Dealer'
      });
      await loadDealers();
      setSelectedDealerId(newD.id);
      setShowAddDealer(false);
      setNewDealerName('');
      setNewDealerPhone('');
    } catch (err) {
      console.error('Failed to quick-add dealer:', err);
      setErrorMessage('Could not add dealer. Please try again.');
    } finally {
      setIsSavingDealer(false);
    }
  };

  // Update line item
  const updateItem = (id: string, updates: Partial<CreditSaleItem>) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, ...updates };

      if ('productId' in updates) {
        const prod = products.find(p => p.id === updates.productId);
        if (prod) {
          const unitRate = prod.mrp ? (prod.mrp * (1 - (prod.companyDiscount || 0) / 100)) : (prod.purchasePrice || 0);
          // Suggest standard rate or purchase price
          const q = parseFloat(updated.quantity) || 1;
          const p = prod.mrp || prod.purchasePrice || 0;
          updated.price = p.toString();
          updated.total = (q * p).toString();
        }
      } else if ('quantity' in updates || 'price' in updates) {
        const q = parseFloat(updated.quantity) || 0;
        const p = parseFloat(updated.price) || 0;
        updated.total = (q * p).toString();
      } else if ('total' in updates) {
        const q = parseFloat(updated.quantity) || 0;
        const t = parseFloat(updated.total) || 0;
        if (q > 0) {
          updated.price = (t / q).toFixed(2);
        }
      }

      return updated;
    }));
  };

  const addItemRow = () => {
    setItems(prev => [...prev, createInitialItem()]);
  };

  const removeItemRow = (id: string) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const grandTotalCredit = useMemo(() => {
    return items.reduce((sum, item) => sum + (parseFloat(item.total) || 0), 0);
  }, [items]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMessage('');

    if (!selectedDealerId) {
      setErrorMessage('Please select a Dealer.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (activeTab === 'credit') {
        const validItems = items.filter(it => it.productId && parseFloat(it.quantity) > 0);
        if (validItems.length === 0) {
          setErrorMessage('Please select at least one valid product with quantity.');
          setIsSubmitting(false);
          return;
        }

        // Validate stock
        for (const it of validItems) {
          const st = stocks.find(s => s.productId === it.productId);
          const p = products.find(prod => prod.id === it.productId);
          const req = parseInt(it.quantity) || 0;
          const avail = st?.remaining || 0;
          if (req > avail) {
            setErrorMessage(`Insufficient stock for '${p?.name || 'Product'}'. Available: ${avail}, Requested: ${req}`);
            setIsSubmitting(false);
            return;
          }
        }

        await khataService.createCreditSale({
          dealer_id: selectedDealerId,
          farmer_name: farmerName.trim() || undefined,
          entry_date: entryDate.toISOString(),
          items: validItems.map(it => {
            const prod = products.find(p => p.id === it.productId);
            return {
              product_id: it.productId,
              name: prod?.name || 'Product',
              quantity: parseInt(it.quantity) || 1,
              price: parseFloat(it.price) || 0,
              total: parseFloat(it.total) || 0
            };
          }),
          remarks: remarks.trim() || undefined
        });

      } else {
        // Recovery Mode
        const recAmt = parseFloat(recoveryAmount);
        if (isNaN(recAmt) || recAmt <= 0) {
          setErrorMessage('Please enter a valid Recovery amount greater than 0.');
          setIsSubmitting(false);
          return;
        }

        if (recoveryMethod === 'ONLINE' && !recoveryBank.trim()) {
          setErrorMessage('Please specify the Bank Name or Account where recovery was received.');
          setIsSubmitting(false);
          return;
        }

        await khataService.createRecovery({
          dealer_id: selectedDealerId,
          entry_date: entryDate.toISOString(),
          amount: recAmt,
          payment_method: recoveryMethod,
          bank_name: recoveryMethod === 'ONLINE' ? recoveryBank.trim() : undefined,
          remarks: remarks.trim() || undefined
        });
      }

      await refreshData();
      onClose();
    } catch (err: any) {
      console.error('Failed to submit Khata entry:', err);
      const msg = err.response?.data?.detail || 'An error occurred while saving. Please try again.';
      setErrorMessage(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header with Mode Toggle */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/30">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
              {activeTab === 'credit' ? (
                <CreditCard className="w-6 h-6 text-rose-600" />
              ) : (
                <Wallet className="w-6 h-6 text-emerald-600" />
              )}
              {activeTab === 'credit' ? 'Record Credit Sale' : 'Record Cash Recovery'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-0.5">
              {activeTab === 'credit' 
                ? 'Deducts shop stock & logs credit to Dealer Khata' 
                : 'Subtracts recovery payment from Dealer Khata (No stock impact)'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Segmented Switch */}
        <div className="px-6 pt-4 pb-2">
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl">
            <button
              type="button"
              onClick={() => { setActiveTab('credit'); setErrorMessage(''); }}
              className={`flex-1 py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all ${
                activeTab === 'credit'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              Credit Sale (Spray Given)
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('recovery'); setErrorMessage(''); }}
              className={`flex-1 py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all ${
                activeTab === 'recovery'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Wallet className="w-4 h-4" />
              Recovery (Amount Received)
            </button>
          </div>
        </div>

        {/* Scrollable Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMessage && (
            <div className="p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/40 rounded-2xl flex items-center gap-3 text-rose-700 dark:text-rose-300 text-xs font-bold animate-in fade-in">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Dealer Selection */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Dealer / Khata Account *
              </label>
              {!showAddDealer && (
                <button
                  type="button"
                  onClick={() => setShowAddDealer(true)}
                  className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  + Add New Dealer
                </button>
              )}
            </div>

            {showAddDealer ? (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-200 dark:border-blue-800/40 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-blue-900 dark:text-blue-200">Add New Dealer</span>
                  <button
                    type="button"
                    onClick={() => setShowAddDealer(false)}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    Cancel
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Dealer Name (e.g. Ahad)"
                    value={newDealerName}
                    onChange={(e) => setNewDealerName(e.target.value)}
                    className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  />
                  <input
                    type="text"
                    placeholder="Phone (Optional)"
                    value={newDealerPhone}
                    onChange={(e) => setNewDealerPhone(e.target.value)}
                    className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleQuickAddDealer}
                  disabled={isSavingDealer || !newDealerName.trim()}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isSavingDealer ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Save & Select Dealer
                </button>
              </div>
            ) : (
              <div className="relative">
                <select
                  value={selectedDealerId}
                  onChange={(e) => setSelectedDealerId(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-900 dark:text-white text-sm outline-none focus:border-blue-500 appearance-none"
                  required
                >
                  <option value="" disabled>-- Select Dealer / Officer --</option>
                  {dealers.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name} {d.phone ? `(${d.phone})` : ''} - [Balance Left: Rs. {formatAmount(d.total_left)}]
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                  ▼
                </div>
              </div>
            )}
          </div>

          {/* Date Picker */}
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Transaction Date *
            </label>
            <CustomDatePicker
              selected={entryDate}
              onChange={(d) => setEntryDate(d || new Date())}
              placeholderText="Select date..."
            />
          </div>

          {/* MODE 1: CREDIT SALE FIELDS */}
          {activeTab === 'credit' && (
            <>
              {/* Farmer Name */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Farmer / Next Customer Name (Optional)
                </label>
                <div className="relative">
                  <User className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Enter the farmer or person who received this spray (optional)"
                    value={farmerName}
                    onChange={(e) => setFarmerName(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-900 dark:text-white text-sm outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              {/* Products Section */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Products Distributed (Taken from Stock) *
                  </label>
                  <span className="text-xs font-bold text-slate-400">
                    {items.length} {items.length === 1 ? 'item' : 'items'}
                  </span>
                </div>

                <div className="space-y-3">
                  {items.map((item, idx) => {
                    const selProd = products.find(p => p.id === item.productId);
                    const st = stocks.find(s => s.productId === item.productId);
                    const avail = st?.remaining || 0;
                    const comp = companies.find(c => c.id === selProd?.companyId);

                    const itemFilteredProducts = products.filter(p => {
                      const matchComp = item.companyId === 'all' || p.companyId === item.companyId;
                      const matchSearch = !item.search || p.name.toLowerCase().includes(item.search.toLowerCase());
                      return matchComp && matchSearch;
                    });

                    return (
                      <div
                        key={item.id}
                        className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3 relative group"
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                            Item #{idx + 1}
                          </span>
                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeItemRow(item.id)}
                              className="text-slate-400 hover:text-rose-500 p-1 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {/* Company and Product Search Filter */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                              Company Filter
                            </label>
                            <select
                              value={item.companyId}
                              onChange={(e) => updateItem(item.id, { companyId: e.target.value })}
                              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-slate-800 dark:text-slate-200 text-xs outline-none focus:border-rose-500"
                            >
                              <option value="all">🏢 All Companies</option>
                              {companies.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                              Search Product
                            </label>
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                              <input
                                type="text"
                                placeholder="Type to search (e.g. 100ml)..."
                                value={item.search}
                                onChange={(e) => updateItem(item.id, { search: e.target.value })}
                                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white text-xs outline-none focus:border-rose-500"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Product Selector */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Select Product * ({itemFilteredProducts.length} matching)
                          </label>
                          <select
                            value={item.productId}
                            onChange={(e) => {
                              const newProdId = e.target.value;
                              const newProd = products.find(p => p.id === newProdId);
                              updateItem(item.id, {
                                productId: newProdId,
                                companyId: newProd?.companyId || item.companyId
                              });
                            }}
                            className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white text-xs outline-none focus:border-rose-500"
                            required
                          >
                            <option value="">-- Choose Product --</option>
                            {itemFilteredProducts.map(p => {
                              const pStock = stocks.find(s => s.productId === p.id);
                              const pComp = companies.find(c => c.id === p.companyId);
                              return (
                                <option key={p.id} value={p.id}>
                                  {p.name} {pComp ? `(${pComp.name})` : ''} - [{pStock?.remaining || 0} in stock]
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        {/* Quantity and Price */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Qty *</label>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateItem(item.id, { quantity: e.target.value })}
                              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white text-xs outline-none focus:border-rose-500"
                              required
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Charged (Rs.) *</label>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={item.total}
                              onChange={(e) => updateItem(item.id, { total: e.target.value })}
                              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-black text-rose-600 dark:text-rose-400 text-xs outline-none focus:border-rose-500"
                              required
                            />
                          </div>
                        </div>

                        {/* Rate preview */}
                        <div className="text-right text-[11px] text-slate-400 font-medium">
                          Rate: Rs. {formatAmount(parseFloat(item.price))} / unit
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={addItemRow}
                  className="w-full py-3 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-rose-400 rounded-2xl text-xs font-black text-slate-600 dark:text-slate-300 flex items-center justify-center gap-1.5 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  + Add Another Product
                </button>
              </div>

              {/* Grand Total Credit Card */}
              <div className="p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/40 rounded-2xl flex justify-between items-center">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-400 block">
                    Total Credit Amount
                  </span>
                  <span className="text-xs text-slate-500 font-bold">Will be added to Dealer dues</span>
                </div>
                <span className="text-2xl font-black text-rose-700 dark:text-rose-300">
                  Rs. {formatAmount(grandTotalCredit)}
                </span>
              </div>
            </>
          )}

          {/* MODE 2: RECOVERY FIELDS */}
          {activeTab === 'recovery' && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl">
                <span className="text-xs text-emerald-800 dark:text-emerald-300 font-bold block mb-1">
                  💡 Cash Recovery Log
                </span>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Enter the cash or payment given by the dealer. This amount will be directly subtracted from their total balance left.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Recovery Amount (Rs.) *
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-emerald-600 dark:text-emerald-400">
                    Rs.
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    placeholder="e.g. 25000"
                    value={recoveryAmount}
                    onChange={(e) => setRecoveryAmount(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-emerald-600 dark:text-emerald-400 text-lg outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Payment Channel: Cash vs Online */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Payment Method *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setRecoveryMethod('CASH');
                      setRecoveryBank('');
                    }}
                    className={`py-3 px-4 rounded-2xl font-black text-xs flex items-center justify-center gap-2 border-2 transition-all ${
                      recoveryMethod === 'CASH'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-700 dark:text-emerald-300 shadow-sm'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Banknote className="w-4 h-4" />
                    Cash Handover
                  </button>

                  <button
                    type="button"
                    onClick={() => setRecoveryMethod('ONLINE')}
                    className={`py-3 px-4 rounded-2xl font-black text-xs flex items-center justify-center gap-2 border-2 transition-all ${
                      recoveryMethod === 'ONLINE'
                        ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-700 dark:text-blue-300 shadow-sm'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Landmark className="w-4 h-4" />
                    Online / Bank Transfer
                  </button>
                </div>
              </div>

              {/* Detail box when Online is selected */}
              {recoveryMethod === 'ONLINE' && (
                <div className="space-y-2.5 p-4 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase tracking-wider text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                      <Landmark className="w-3.5 h-3.5" />
                      Received in Bank / Account *
                    </label>
                    <span className="text-[10px] text-blue-500 font-bold">Specify Bank Name</span>
                  </div>

                  <input
                    type="text"
                    required={recoveryMethod === 'ONLINE'}
                    placeholder="e.g. Meezan Bank, HBL, Allied Bank, JazzCash..."
                    value={recoveryBank}
                    onChange={(e) => setRecoveryBank(e.target.value)}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-blue-300 dark:border-blue-700 rounded-xl font-bold text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />

                  {/* Quick Bank Selection Chips */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {['Meezan Bank', 'HBL', 'Allied Bank', 'MCB', 'UBL', 'Bank Alfalah', 'JazzCash', 'Easypaisa'].map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setRecoveryBank(b)}
                        className={`text-[11px] px-2.5 py-1 rounded-lg font-bold transition-all ${
                          recoveryBank === b
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-blue-400'
                        }`}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Remarks (Common) */}
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Remarks / Notes (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. spray details, bank transfer note, field visit"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500"
            />
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-4 rounded-2xl font-black text-white text-sm shadow-xl flex items-center justify-center gap-2 transition-all active:scale-98 disabled:opacity-50 ${
                activeTab === 'credit'
                  ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/30'
                  : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Saving Transaction...
                </>
              ) : activeTab === 'credit' ? (
                <>
                  <CreditCard className="w-5 h-5" />
                  Save Credit Sale (Rs. {formatAmount(grandTotalCredit)})
                </>
              ) : (
                <>
                  <Wallet className="w-5 h-5" />
                  Save Recovery (Rs. {formatAmount(parseFloat(recoveryAmount || '0'))})

                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreditSaleModal;
