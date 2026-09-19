import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Building2,
  Package,
  Plus,
  Trash2,
  Calendar,
  CheckCircle,
  Loader2,
  ArrowRight,
  Search,
  ChevronDown
} from 'lucide-react';
import CustomDatePicker from './CustomDatePicker';
import { companyKhataService, CompanyKhataOverview } from '../utils/companyKhataApi';
import { useData } from '../context/DataContext';

interface LineItem {
  productId: string;
  quantity: string;
  totalPrice: string;
}

interface CompanyPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preselectedCompanyId?: string;
  companiesList?: CompanyKhataOverview[];
}

export const CompanyPurchaseModal: React.FC<CompanyPurchaseModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  preselectedCompanyId,
  companiesList = []
}) => {
  const { companies: catalogCompanies, products, stocks, refreshData } = useData();
  const [accounts, setAccounts] = useState<CompanyKhataOverview[]>(companiesList);
  const [companyId, setCompanyId] = useState<string>(preselectedCompanyId || '');
  const [purchaseDate, setPurchaseDate] = useState<Date | null>(new Date());
  const [items, setItems] = useState<LineItem[]>([
    { productId: '', quantity: '', totalPrice: '' }
  ]);
  const [remarks, setRemarks] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Active open dropdown for product search per item index
  const [openProductDropdownIdx, setOpenProductDropdownIdx] = useState<number | null>(null);
  const [productSearchTerms, setProductSearchTerms] = useState<{ [key: number]: string }>({});

  useEffect(() => {
    if (isOpen) {
      if (companiesList.length > 0) {
        setAccounts(companiesList);
        setCompanyId(preselectedCompanyId || (companiesList[0].account_id || companiesList[0].company_id));
      } else {
        companyKhataService.getOverview().then(data => {
          setAccounts(data);
          if (!preselectedCompanyId && data.length > 0) {
            setCompanyId(data[0].account_id || data[0].company_id);
          }
        }).catch(err => console.error(err));
        setCompanyId(preselectedCompanyId || '');
      }

      setPurchaseDate(new Date());
      setItems([{ productId: '', quantity: '', totalPrice: '' }]);
      setRemarks('');
      setError('');
      setIsSubmitting(false);
      setOpenProductDropdownIdx(null);
      setProductSearchTerms({});
      setFilterByCompanyOnly(true);
    }
  }, [isOpen, preselectedCompanyId, companiesList]);

  const [filterByCompanyOnly, setFilterByCompanyOnly] = useState<boolean>(true);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenProductDropdownIdx(null);
      }
    };
    if (openProductDropdownIdx !== null) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openProductDropdownIdx]);

  const selectedAccount = useMemo(() => {
    return accounts.find(c => (c.account_id || c.company_id) === companyId);
  }, [accounts, companyId]);

  // 1. Determine company-specific products
  const companySpecificProducts = useMemo(() => {
    if (!selectedAccount) return [];

    // Check 1: Linked catalog company ID
    const targetCatalogId = selectedAccount.catalog_company_id;
    if (targetCatalogId) {
      const matched = products.filter(
        p => p.companyId === targetCatalogId || (p as any).company_id === targetCatalogId
      );
      if (matched.length > 0) return matched;
    }

    // Check 2: Match by company name with catalog companies
    const accName = (
      selectedAccount.name ||
      selectedAccount.company_name ||
      selectedAccount.catalog_company_name ||
      ''
    ).trim().toLowerCase();

    if (accName) {
      let matchedCat = catalogCompanies.find(
        c => c.name.trim().toLowerCase() === accName
      );
      if (!matchedCat) {
        matchedCat = catalogCompanies.find(
          c => c.name.trim().toLowerCase().includes(accName) || accName.includes(c.name.trim().toLowerCase())
        );
      }
      if (matchedCat) {
        const matched = products.filter(
          p => p.companyId === matchedCat.id || (p as any).company_id === matchedCat.id
        );
        if (matched.length > 0) return matched;
      }
    }

    return [];
  }, [selectedAccount, products, catalogCompanies]);

  // Determine products available for this company
  const availableProducts = useMemo(() => {
    if (!selectedAccount) return products;

    if (filterByCompanyOnly && companySpecificProducts.length > 0) {
      return companySpecificProducts;
    }

    return products;
  }, [selectedAccount, filterByCompanyOnly, companySpecificProducts, products]);

  if (!isOpen) return null;

  const handleAddItem = () => {
    setItems(prev => [...prev, { productId: '', quantity: '', totalPrice: '' }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, i) => i !== index));
    if (openProductDropdownIdx === index) {
      setOpenProductDropdownIdx(null);
    }
  };

  const handleItemChange = (index: number, field: keyof LineItem, value: string) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSelectProduct = (index: number, prodId: string) => {
    handleItemChange(index, 'productId', prodId);
    setOpenProductDropdownIdx(null);
  };

  const handleToggleDropdown = (idx: number) => {
    if (openProductDropdownIdx === idx) {
      setOpenProductDropdownIdx(null);
    } else {
      setOpenProductDropdownIdx(idx);
      setProductSearchTerms(prev => ({ ...prev, [idx]: '' }));
    }
  };

  const grandTotal = items.reduce((sum, item) => {
    const p = parseFloat(item.totalPrice) || 0;
    return sum + p;
  }, 0);

  const totalUnits = items.reduce((sum, item) => {
    const q = parseInt(item.quantity, 10) || 0;
    return sum + q;
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!companyId) {
      setError('Please select a company account');
      return;
    }

    if (items.length === 0) {
      setError('Please add at least one product');
      return;
    }

    // Validate line items
    const parsedItems = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.productId) {
        setError(`Please select a product for item #${i + 1}`);
        return;
      }
      const qty = parseInt(item.quantity, 10);
      if (!qty || qty <= 0) {
        setError(`Please enter a valid quantity for item #${i + 1}`);
        return;
      }
      const total = parseFloat(item.totalPrice);
      if (!total || total <= 0) {
        setError(`Please enter a valid total price for item #${i + 1}`);
        return;
      }
      parsedItems.push({
        product_id: item.productId,
        quantity: qty,
        total_price: total
      });
    }

    try {
      setIsSubmitting(true);
      setError('');

      await companyKhataService.recordPurchase({
        account_id: companyId,
        company_id: companyId,
        entry_date: purchaseDate ? purchaseDate.toISOString() : new Date().toISOString(),
        items: parsedItems,
        remarks: remarks.trim() || undefined
      });

      // Refresh global app data to reflect updated stock and purchase prices
      await refreshData();

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to record company purchase:', err);
      setError(err?.response?.data?.detail || 'Failed to record purchase. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gradient-to-r from-blue-600/10 to-indigo-600/10 dark:from-blue-950/20 dark:to-indigo-950/20 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Receive Stock from Company</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Add inward shipment: auto-updates stock & calculates unit purchase price</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-xl text-red-600 dark:text-red-400 text-sm font-medium">
              {error}
            </div>
          )}

          {/* Company & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                Company Account *
              </label>
              {preselectedCompanyId ? (
                <div className="p-2.5 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl flex items-center gap-2.5">
                  <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="font-semibold text-sm text-gray-900 dark:text-white">
                    {selectedAccount?.name || selectedAccount?.company_name || 'Company'}
                  </span>
                </div>
              ) : accounts.length === 0 ? (
                <div className="p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-xl text-amber-700 dark:text-amber-400 text-xs font-bold">
                  No companies added yet. Click "+ ADD COMPANY" first.
                </div>
              ) : (
                <select
                  value={companyId}
                  onChange={(e) => {
                    setCompanyId(e.target.value);
                    setItems([{ productId: '', quantity: '', totalPrice: '' }]);
                    setOpenProductDropdownIdx(null);
                  }}
                  required
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-sm"
                >
                  <option value="" disabled>-- Select Company --</option>
                  {accounts.map((comp) => {
                    const id = comp.account_id || comp.company_id;
                    const label = comp.name || comp.company_name;
                    return (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                Delivery / Invoice Date *
              </label>
              <CustomDatePicker
                selected={purchaseDate}
                onChange={(date) => setPurchaseDate(date)}
                placeholderText="Select Date"
                maxDate={new Date()}
              />
            </div>
          </div>

          {/* Products List Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Products Received ({items.length})
                </label>
                {selectedAccount && companySpecificProducts.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setFilterByCompanyOnly(prev => !prev)}
                    title="Click to toggle between company-specific products and all catalog products"
                    className="text-[11px] font-bold px-2.5 py-0.5 rounded-full transition flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800"
                  >
                    <span>
                      {filterByCompanyOnly
                        ? `${companySpecificProducts.length} ${selectedAccount.name || selectedAccount.company_name} Products`
                        : `All Catalog Products (${products.length})`}
                    </span>
                    <span className="text-[10px] font-normal underline opacity-80">
                      ({filterByCompanyOnly ? 'Show all' : 'Only this company'})
                    </span>
                  </button>
                ) : (
                  <span className="text-[11px] font-bold text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                    {availableProducts.length} product{availableProducts.length !== 1 ? 's' : ''} available
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:underline"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Another Product
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => {
                const prod = products.find(p => p.id === item.productId);
                const curStock = stocks[item.productId]?.remaining ?? 0;
                const qtyNum = parseInt(item.quantity, 10) || 0;
                const totalNum = parseFloat(item.totalPrice) || 0;
                const unitPrice = qtyNum > 0 && totalNum > 0 ? (totalNum / qtyNum).toFixed(2) : null;
                const newStockPreview = qtyNum > 0 ? curStock + qtyNum : null;

                const searchTerm = (productSearchTerms[idx] || '').toLowerCase();
                const filteredProdsForDropdown = availableProducts.filter(p =>
                  p.name.toLowerCase().includes(searchTerm) ||
                  (p.category && p.category.toLowerCase().includes(searchTerm))
                );

                const isDropdownOpen = openProductDropdownIdx === idx;

                return (
                  <div
                    key={idx}
                    style={{ zIndex: isDropdownOpen ? 40 : items.length - idx }}
                    className="p-4 bg-gray-50/80 dark:bg-gray-800/50 border border-gray-200/80 dark:border-gray-700/80 rounded-xl space-y-3 relative transition"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">
                        Item #{idx + 1}
                      </span>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 rounded transition"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                      {/* Searchable Product Selector */}
                      <div className="sm:col-span-6 relative">
                        <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                          Product *
                        </label>

                        {/* Trigger Button */}
                        <div
                          onClick={() => handleToggleDropdown(idx)}
                          className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white flex items-center justify-between cursor-pointer hover:border-blue-500 transition"
                        >
                          <span className={prod ? 'font-bold text-gray-900 dark:text-white truncate pr-2' : 'text-gray-400'}>
                            {prod ? `${prod.name} (${prod.unit})` : '-- Select / Search Product --'}
                          </span>
                          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180 text-blue-500' : ''}`} />
                        </div>

                        {/* Search & Select Popover */}
                        {isDropdownOpen && (
                          <div
                            ref={dropdownRef}
                            className="absolute top-full left-0 right-0 mt-1 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl p-2 max-h-64 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100"
                          >
                            {/* Search bar inside dropdown */}
                            <div className="relative mb-2 flex-shrink-0">
                              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                              <input
                                type="text"
                                autoFocus
                                value={productSearchTerms[idx] || ''}
                                onChange={(e) => {
                                  setProductSearchTerms(prev => ({ ...prev, [idx]: e.target.value }));
                                }}
                                placeholder={`Search ${availableProducts.length} product${availableProducts.length !== 1 ? 's' : ''}...`}
                                className="w-full pl-8 pr-3 py-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>

                            {/* Options List */}
                            <div className="overflow-y-auto flex-1 space-y-1 max-h-48">
                              {filteredProdsForDropdown.length === 0 ? (
                                <div className="p-3 text-center text-xs text-gray-400">
                                  No matching products found
                                </div>
                              ) : (
                                filteredProdsForDropdown.map(p => {
                                  const pStock = stocks[p.id]?.remaining ?? 0;
                                  const isSelected = p.id === item.productId;

                                  return (
                                    <div
                                      key={p.id}
                                      onClick={() => handleSelectProduct(idx, p.id)}
                                      className={`px-3 py-2 rounded-lg text-xs cursor-pointer flex items-center justify-between transition ${
                                        isSelected
                                          ? 'bg-blue-600 text-white font-bold'
                                          : 'hover:bg-gray-100 dark:hover:bg-gray-700/60 text-gray-800 dark:text-gray-200'
                                      }`}
                                    >
                                      <div className="min-w-0 pr-2">
                                        <div className="font-bold truncate">{p.name}</div>
                                        <div className={`text-[10px] ${isSelected ? 'text-blue-100' : 'text-gray-400'}`}>
                                          {p.unit} • {p.category || 'General'}
                                        </div>
                                      </div>
                                      <span
                                        className={`px-2 py-0.5 rounded text-[10px] font-bold flex-shrink-0 ${
                                          isSelected
                                            ? 'bg-blue-700 text-white'
                                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                                        }`}
                                      >
                                        Stock: {pStock}
                                      </span>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        )}

                        {/* Stock Preview */}
                        {item.productId && (
                          <div className="mt-1 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                            <span>Current Stock: <strong className="text-gray-800 dark:text-gray-200">{curStock} {prod?.unit || 'units'}</strong></span>
                            {newStockPreview !== null && (
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                                <ArrowRight className="w-3 h-3" /> Will become: {newStockPreview} {prod?.unit || 'units'}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Quantity */}
                      <div className="sm:col-span-3">
                        <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                          Quantity ({prod?.unit || 'Units'}) *
                        </label>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          placeholder="e.g. 10"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                          required
                          className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-semibold text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      {/* Total Price for this item */}
                      <div className="sm:col-span-3">
                        <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                          Total Price (Rs.) *
                        </label>
                        <input
                          type="number"
                          min="1"
                          step="any"
                          placeholder="e.g. 100000"
                          value={item.totalPrice}
                          onChange={(e) => handleItemChange(idx, 'totalPrice', e.target.value)}
                          required
                          className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-semibold text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    {/* Auto-Calculated Unit Price Card */}
                    {unitPrice && (
                      <div className="p-2.5 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/30 rounded-lg flex items-center justify-between text-xs">
                        <div className="text-gray-600 dark:text-gray-300">
                          Unit Purchase Price: <span className="font-mono font-medium">Rs. {Number(totalNum).toLocaleString()} ÷ {qtyNum} units</span>
                        </div>
                        <div className="font-bold text-blue-700 dark:text-blue-400">
                          = Rs. {Number(unitPrice).toLocaleString()} / {prod?.unit || 'unit'}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Grand Summary Card */}
          <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-900/40 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Total Inward Bill</span>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {items.length} product(s), {totalUnits} total unit(s)
              </p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-blue-700 dark:text-blue-300">
                Rs. {Number(grandTotal).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
              Bilty / Invoice / Remarks <span className="text-gray-400 normal-case">(Optional)</span>
            </label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Invoice # 84920, Bilty # 1204 via Faisal Movers"
              className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-gray-100 dark:border-gray-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || accounts.length === 0}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-lg shadow-blue-600/20 transition"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Receiving Stock...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Confirm Stock Receipt
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CompanyPurchaseModal;
