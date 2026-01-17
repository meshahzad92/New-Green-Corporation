/// <reference types="vite/client" />
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { Plus, Edit2, Trash2, Building2, Search, X } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';


const Companies: React.FC = () => {
  const { companies, addCompany, updateCompany, deleteCompany } = useData();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    companyId: '',
    companyName: ''
  });


  const filteredCompanies = companies.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Dynamic logo loading using Vite's glob import
  const logoModules = import.meta.glob('../logos/*.{png,jpg,jpeg,svg,webp}', { eager: true });

  const getCompanyLogo = (companyName: string) => {
    // Try to find a logo that matches the company name (ignoring case and extension)
    const logoEntry = Object.entries(logoModules).find(([path]) => {
      const fileName = path.split('/').pop()?.split('.')[0].toLowerCase();
      return fileName === companyName.toLowerCase();
    });

    return logoEntry ? (logoEntry[1] as any).default : null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingId) {
      await updateCompany(editingId, name);
    } else {
      await addCompany(name);
    }

    handleClose();
  };

  const handleEdit = (e: React.MouseEvent, id: string, currentName: string) => {
    e.stopPropagation();
    setEditingId(id);
    setName(currentName);
    setIsModalOpen(true);
  };

  const handleDelete = async (e: React.MouseEvent, id: string, companyName: string) => {
    e.stopPropagation();
    setConfirmDialog({
      isOpen: true,
      companyId: id,
      companyName: companyName
    });
  };

  const confirmDelete = async () => {
    const success = await deleteCompany(confirmDialog.companyId);
    if (!success) {
      alert('Cannot delete company because it has products linked to it.');
    }
  };


  const handleClose = () => {
    setEditingId(null);
    setName('');
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Supply Partners</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Manage your manufacturer and distributor list</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-2xl flex items-center gap-3 font-bold shadow-xl shadow-emerald-600/20 transition-all active:scale-95"
        >
          <Plus className="w-5 h-5 stroke-[3px]" />
          ADD COMPANY
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-6 shadow-sm border border-slate-200/60 dark:border-slate-700">
        <div className="relative mb-8">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search partners by name..."
            className="w-full pl-14 pr-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-none focus:ring-2 focus:ring-emerald-500 outline-none transition-all placeholder:text-slate-400 font-bold text-slate-900 dark:text-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCompanies.map((company) => {
            const logo = getCompanyLogo(company.name);
            return (
              <div
                key={company.id}
                onClick={() => navigate(`/products?companyId=${company.id}`)}
                className="group p-6 border border-slate-100 dark:border-slate-700 rounded-3xl hover:border-emerald-200 hover:bg-emerald-50/30 dark:hover:bg-emerald-900/10 transition-all shadow-sm cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-white dark:bg-slate-900/50 rounded-2xl flex items-center justify-center shadow-sm border border-slate-100 dark:border-slate-700 p-2 overflow-hidden">
                      {logo ? (
                        <img src={logo} alt={company.name} className="w-full h-full object-contain" />
                      ) : (
                        <Building2 className="w-8 h-8 text-emerald-600/40" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-lg">{company.name}</h3>
                      <p className="text-xs text-slate-400 font-medium">Reg: {new Date(company.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => handleEdit(e, company.id, company.name)}
                      className="p-2 text-slate-400 hover:text-emerald-600 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(e, company.id, company.name)}
                      className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredCompanies.length === 0 && (
          <div className="py-24 text-center text-slate-400">
            <Building2 className="w-16 h-16 mx-auto mb-4 opacity-10" />
            <p className="text-lg font-bold">No partners found.</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-white/20">
            <div className="bg-emerald-600 p-8 text-white flex items-center justify-between">
              <h2 className="text-2xl font-black">{editingId ? 'Edit Partner' : 'New Partner'}</h2>
              <button onClick={handleClose} className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Partner Company Name</label>
                <input
                  autoFocus
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-emerald-500 outline-none transition-all font-bold text-slate-900 dark:text-white"
                  placeholder="e.g. Monsanto Agri"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full bg-emerald-600 text-white font-black py-5 rounded-2xl hover:bg-emerald-700 transition-all active:scale-95 shadow-xl shadow-emerald-600/30 tracking-widest uppercase"
              >
                {editingId ? 'Save Changes' : 'Confirm Registration'}
              </button>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title="Delete Company"
        message={`Are you sure you want to delete "${confirmDialog.companyName}"? This action cannot be undone.`}
        confirmText="Yes, Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDialog({ isOpen: false, companyId: '', companyName: '' })}
        isDangerous={true}
      />
    </div>
  );
};

export default Companies;
