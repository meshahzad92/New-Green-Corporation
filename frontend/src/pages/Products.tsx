import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { Plus, Edit2, Trash2, Package, Search, Building2, X, ChevronRight, AlertCircle } from 'lucide-react';
import { Product } from '../types';
import ConfirmDialog from '../components/ConfirmDialog';
import { formatAmount } from '../utils/formatters';

const Products: React.FC = () => {
  const { companies, products, stocks, stockTransactions, sales, addProduct, updateProduct, deleteProduct } = useData();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<string>('all');
  const [showLowStock, setShowLowStock] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const companyId = params.get('companyId');
    if (companyId) {
      setSelectedCompany(companyId);
    }
  }, [location.search]);

  const [formData, setFormData] = useState({
    companyId: '',
    name: '',
    category: 'Fertilizer',
    unit: 'Bags',
    minStock: 5
  });

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    productId: '',
    productName: ''
  });

  // Blocked action alert dialog (cannot delete product with stock logs or sales)
  const [blockedDialog, setBlockedDialog] = useState({
    isOpen: false,
    title: '',
    message: ''
  });

  const [modalError, setModalError] = useState('');
  const categories = ['Fertilizer', 'Seeds', 'Pesticide', 'Tools', 'Other'];

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

    return result;
  }, [products, stocks]);

  const filteredProducts = uniqueProducts
    .filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCompany = selectedCompany === 'all' || p.companyId === selectedCompany;
      const stock = stocks.find(s => s.productId === p.id);
      const matchesLowStock = !showLowStock || (stock?.remaining || 0) <= p.minStock;
      return matchesSearch && matchesCompany && matchesLowStock;
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setModalError('');

    const trimmedName = formData.name.trim().toLowerCase();
    const isDuplicate = products.some(p => 
      p.companyId === formData.companyId &&
      p.name.trim().toLowerCase() === trimmedName &&
      p.id !== editingId
    );

    if (isDuplicate) {
      const compObj = companies.find(c => c.id === formData.companyId);
      setModalError(`A product named "${formData.name.trim()}" already exists for ${compObj?.name || 'the selected company'}.`);
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingId) {
        const existingProduct = products.find(p => p.id === editingId);
        await updateProduct(editingId, { ...formData, name: formData.name.trim(), purchasePrice: existingProduct?.purchasePrice || 0 });
      } else {
        await addProduct({ ...formData, name: formData.name.trim() });
      }
      handleClose();
    } catch (err) {
      console.error('Failed to save product:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingId(null);
    setModalError('');
    setFormData({
      companyId: selectedCompany !== 'all' ? selectedCompany : '',
      name: '',
      category: 'Fertilizer',
      unit: 'Bags',
      minStock: 5
    });
    setIsModalOpen(true);
  };

  const handleEdit = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    setEditingId(product.id);
    setModalError('');
    setFormData({
      companyId: product.companyId,
      name: product.name,
      category: product.category,
      unit: product.unit,
      minStock: product.minStock
    });
    setIsModalOpen(true);
  };

  const handleClose = () => {
    setEditingId(null);
    setModalError('');
    setFormData({
      companyId: '',
      name: '',
      category: 'Fertilizer',
      unit: 'Bags',
      minStock: 5
    });
    setIsModalOpen(false);
  };

  const handleDeleteClick = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    const productLogs = stockTransactions.filter(t => t.productId === product.id && !t.isDeleted);
    const productSales = sales.filter(s => s.productId === product.id && !s.isDeleted);
    const stock = stocks.find(s => s.productId === product.id);
    const remainingStock = stock?.remaining || 0;

    if (productLogs.length > 0 || productSales.length > 0 || remainingStock > 0) {
      const details: string[] = [];
      if (productLogs.length > 0) details.push(`${productLogs.length} stock log(s)`);
      if (productSales.length > 0) details.push(`${productSales.length} sale(s)`);
      if (remainingStock > 0) details.push(`${remainingStock} ${product.unit} remaining in stock`);

      setBlockedDialog({
        isOpen: true,
        title: 'Cannot Delete Product',
        message: `"${product.name}" cannot be deleted because it has active history linked to it (${details.join(', ')}). Products with stock logs or sales history cannot be deleted to preserve financial audits. If you no longer sell this product, leave its stock at 0.`
      });
      return;
    }

    setConfirmDialog({
      isOpen: true,
      productId: product.id,
      productName: product.name
    });
  };

  const handleConfirmDelete = async () => {
    const success = await deleteProduct(confirmDialog.productId);
    if (!success) {
      setBlockedDialog({
        isOpen: true,
        title: 'Cannot Delete Product',
        message: `Cannot delete "${confirmDialog.productName}" because stock transactions or sales history exist for this product in the database.`
      });
    }
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Product Catalog</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Click on any product to see stock & details</p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-2xl flex items-center gap-3 font-bold shadow-xl shadow-emerald-600/20 transition-all active:scale-95"
        >
          <Plus className="w-5 h-5 stroke-[3px]" />
          ADD PRODUCT
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-sm border border-slate-200/60 dark:border-slate-700 space-y-4">
        {/* Full-width horizontal search bar */}
        <div className="relative w-full">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name..."
            className="w-full pl-14 pr-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-none outline-none font-semibold text-slate-900 dark:text-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Company dropdown + Low Stock toggle */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              className="px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500 min-w-[160px]"
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
                : 'bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-rose-400 hover:text-rose-500'
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

          {/* Active filter count badge */}
          {(selectedCompany !== 'all' || showLowStock) && (
            <button
              onClick={() => { setSelectedCompany('all'); setShowLowStock(false); }}
              className="text-[10px] font-black text-slate-400 hover:text-rose-500 transition-colors uppercase tracking-widest"
            >
              ✕ Clear Filters
            </button>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] overflow-hidden shadow-sm border border-slate-200/60 dark:border-slate-700">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-[10px] uppercase text-slate-400 font-black tracking-widest border-b border-slate-100 dark:border-slate-700">
              <tr>
                <th className="px-8 py-6">Product Details</th>
                <th className="px-8 py-6">Company</th>
                <th className="px-8 py-6 text-center">Available Stock</th>
                <th className="px-8 py-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {filteredProducts.map((product) => {
                const comp = companies.find(c => c.id === product.companyId);
                const stock = stocks.find(s => s.productId === product.id);
                return (
                  <tr
                    key={product.id}
                    onClick={() => navigate(`/products/${product.id}`)}
                    className="group cursor-pointer hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-colors"
                  >
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-2xl flex items-center justify-center shadow-sm">
                          <Package className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white text-base leading-tight">{product.name}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-[9px] px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 rounded-md font-black uppercase">{product.category}</span>
                            {product.mrp && product.mrp > 0 && (
                              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                                MRP: Rs. {formatAmount(product.mrp)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 font-bold text-slate-600 dark:text-slate-300">
                      {comp?.name || 'N/A'}
                    </td>
                    <td className="px-8 py-6 text-center">
                      <span className={`font-black text-xl ${(stock?.remaining || 0) <= product.minStock ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {stock?.remaining || 0}
                      </span>
                      <span className="text-[10px] ml-1 text-slate-400 font-bold uppercase">{product.unit}</span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => handleEdit(e, product)} className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-emerald-500 rounded-xl transition-all shadow-sm">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={(e) => handleDeleteClick(e, product)} className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-red-500 rounded-xl transition-all shadow-sm">
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <ChevronRight className="w-5 h-5 text-slate-300 ml-2" />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredProducts.length === 0 && (
            <div className="py-24 text-center text-slate-400">
              <Package className="w-16 h-16 mx-auto mb-4 opacity-10" />
              <p className="text-lg font-bold">No products found.</p>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/20">
            <div className="bg-emerald-600 p-8 text-white flex items-center justify-between">
              <h2 className="text-2xl font-black">{editingId ? 'Modify Product' : 'Register New Product'}</h2>
              <button onClick={handleClose} className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              {modalError && (
                <div className="bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 p-4 rounded-2xl text-sm border border-rose-100 dark:border-rose-900/30 font-bold animate-in slide-in-from-top-2">
                  {modalError}
                </div>
              )}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-500">Product Name</label>
                <input
                  autoFocus
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-emerald-500 outline-none font-bold text-slate-900 dark:text-white"
                  placeholder="e.g. Urea Special"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-500">Company</label>
                <select
                  value={formData.companyId}
                  onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
                  className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-emerald-500 outline-none font-bold text-slate-900 dark:text-white appearance-none"
                  required
                >
                  <option value="">Select Company</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-500">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-emerald-500 outline-none font-bold text-slate-900 dark:text-white appearance-none"
                    required
                  >
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-500">Unit Label</label>
                  <input
                    type="text"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-emerald-500 outline-none font-bold text-slate-900 dark:text-white"
                    placeholder="e.g. Bags"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-emerald-600 text-white font-black py-5 rounded-2xl shadow-xl shadow-emerald-600/30 uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving Product...
                  </>
                ) : (
                  editingId ? 'Save Changes' : 'Confirm Product'
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title="Delete Product"
        message={`Are you sure you want to delete "${confirmDialog.productName}"? This action cannot be undone.`}
        confirmText="Yes, Delete"
        cancelText="Cancel"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDialog({ isOpen: false, productId: '', productName: '' })}
        isDangerous={true}
      />

      {/* Blocked Action Alert Dialog (When Stock Logs or Sales Exist) */}
      <ConfirmDialog
        isOpen={blockedDialog.isOpen}
        title={blockedDialog.title}
        message={blockedDialog.message}
        confirmText="Understood"
        onCancel={() => setBlockedDialog({ isOpen: false, title: '', message: '' })}
        alertOnly={true}
        isDangerous={true}
      />
    </div>
  );
};

export default Products;
