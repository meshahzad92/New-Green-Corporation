import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { Plus, Edit2, Trash2, Package, Search, Building2, X, ChevronRight } from 'lucide-react';
import { Product } from '../types';
import ConfirmDialog from '../components/ConfirmDialog';

const Products: React.FC = () => {
  const { companies, products, stocks, addProduct, updateProduct, deleteProduct } = useData();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

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

  const categories = ['Fertilizer', 'Seeds', 'Pesticide', 'Tools', 'Other'];

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCompany = selectedCompany === 'all' || p.companyId === selectedCompany;
    return matchesSearch && matchesCompany;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      await updateProduct(editingId, { ...formData, purchasePrice: 0 }); // purchasePrice managed via Stock entries
    } else {
      await addProduct(formData);
    }
    handleClose();
  };

  const handleEdit = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    setEditingId(product.id);
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
    setFormData({
      companyId: '',
      name: '',
      category: 'Fertilizer',
      unit: 'Bags',
      minStock: 5
    });
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Product Catalog</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Click on any product to see stock & details</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-2xl flex items-center gap-3 font-bold shadow-xl shadow-emerald-600/20 transition-all active:scale-95"
        >
          <Plus className="w-5 h-5 stroke-[3px]" />
          ADD PRODUCT
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-sm border border-slate-200/60 dark:border-slate-700 space-y-5">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name..."
              className="w-full pl-14 pr-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-none outline-none font-semibold text-slate-900 dark:text-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 px-1 items-center no-scrollbar">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">Companies:</span>
            <button onClick={() => setSelectedCompany('all')} className={`px-5 py-3 rounded-xl text-xs font-bold ${selectedCompany === 'all' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}`}>All</button>
            {companies.map(company => (
              <button key={company.id} onClick={() => setSelectedCompany(company.id)} className={`px-5 py-3 rounded-xl text-xs font-bold whitespace-nowrap ${selectedCompany === company.id ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}`}>
                {company.name}
              </button>
            ))}
          </div>
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
                          <span className="text-[9px] px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 rounded-md font-black uppercase mt-1 inline-block">{product.category}</span>
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
                        <button onClick={(e) => { e.stopPropagation(); setConfirmDialog({ isOpen: true, productId: product.id, productName: product.name }); }} className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-red-500 rounded-xl transition-all shadow-sm">
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

              <button type="submit" className="w-full bg-emerald-600 text-white font-black py-5 rounded-2xl shadow-xl shadow-emerald-600/30 uppercase tracking-widest">
                Confirm Product
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
        onConfirm={() => deleteProduct(confirmDialog.productId)}
        onCancel={() => setConfirmDialog({ isOpen: false, productId: '', productName: '' })}
        isDangerous={true}
      />
    </div>
  );
};

export default Products;
