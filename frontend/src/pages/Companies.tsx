/// <reference types="vite/client" />
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { Plus, Edit2, Trash2, Building2, Search, X, Image as ImageIcon, Upload } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import { formatDate } from '../utils/formatters';
import { resolveCompanyLogo } from '../utils/logoHelper';


const Companies: React.FC = () => {
  const { companies, addCompany, updateCompany, uploadCompanyLogo, deleteCompany, products } = useData();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [logoDataUrl, setLogoDataUrl] = useState<string>('');
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [existingLogo, setExistingLogo] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    companyId: '',
    companyName: ''
  });

  // Blocked action alert dialog (cannot delete company with products)
  const [blockedDialog, setBlockedDialog] = useState({
    isOpen: false,
    title: '',
    message: ''
  });

  const filteredCompanies = companies.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const compressImageToDataUrl = (file: File, maxSize = 256): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxSize) {
              height = Math.round((height * maxSize) / width);
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width = Math.round((width * maxSize) / height);
              height = maxSize;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(reader.result as string);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/png', 0.9));
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      let finalLogo: string | undefined = undefined;

      if (logoDataUrl) {
        finalLogo = logoDataUrl;
      } else if (editingId && existingLogo) {
        finalLogo = existingLogo;
      }

      if (editingId) {
        await updateCompany(editingId, name.trim(), finalLogo);
      } else {
        await addCompany(name.trim(), finalLogo);
      }
      handleClose();
    } catch (err) {
      console.error('Failed to save company:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (e: React.MouseEvent, company: any) => {
    e.stopPropagation();
    setEditingId(company.id);
    setName(company.name);
    setExistingLogo(company.logo || '');
    
    // Set logo preview if available
    const existingLogoUrl = resolveCompanyLogo(company.logo, company.name);
    setLogoPreview(existingLogoUrl || '');
    setLogoDataUrl('');
    
    setIsModalOpen(true);
  };

  const handleDelete = (e: React.MouseEvent, id: string, companyName: string) => {
    e.stopPropagation();
    const linkedProducts = products.filter(p => p.companyId === id);
    if (linkedProducts.length > 0) {
      setBlockedDialog({
        isOpen: true,
        title: 'Cannot Delete Company',
        message: `"${companyName}" cannot be deleted because it has ${linkedProducts.length} product(s) linked to it (e.g. ${linkedProducts.slice(0, 3).map(p => p.name).join(', ')}${linkedProducts.length > 3 ? '...' : ''}). A company with active products cannot be removed. Please reassign or delete its products first.`
      });
      return;
    }

    setConfirmDialog({
      isOpen: true,
      companyId: id,
      companyName: companyName
    });
  };

  const confirmDelete = async () => {
    const success = await deleteCompany(confirmDialog.companyId);
    if (!success) {
      setBlockedDialog({
        isOpen: true,
        title: 'Cannot Delete Company',
        message: `Cannot delete "${confirmDialog.companyName}" because products are linked to this company in the database.`
      });
    }
  };


  const handleClose = () => {
    setEditingId(null);
    setName('');
    setLogoDataUrl('');
    setLogoPreview('');
    setExistingLogo('');
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
            const logo = resolveCompanyLogo(company.logo, company.name);
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
                      <p className="text-xs text-slate-400 font-medium">Reg: {formatDate(company.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => handleEdit(e, company)}
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
              {/* Logo Upload */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Company Logo (Optional)</label>
                <div 
                  onClick={() => document.getElementById('logo-upload-input')?.click()}
                  className="relative w-full h-36 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-600 flex items-center justify-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/30 dark:hover:bg-emerald-900/10 transition-all overflow-hidden"
                >
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo preview" className="w-full h-full object-contain p-3" />
                  ) : (
                    <div className="text-center text-slate-400">
                      <ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="text-xs font-bold">Click to upload logo</p>
                      <p className="text-[10px] font-medium opacity-60">PNG, JPG, SVG</p>
                    </div>
                  )}
                  {logoPreview && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white text-xs font-black flex items-center gap-1"><Upload className="w-4 h-4" /> Change</span>
                    </div>
                  )}
                </div>
                <input
                  id="logo-upload-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      try {
                        const compressed = await compressImageToDataUrl(file);
                        setLogoDataUrl(compressed);
                        setLogoPreview(compressed);
                      } catch {
                        const r = new FileReader();
                        r.onload = () => {
                          const str = r.result as string;
                          setLogoDataUrl(str);
                          setLogoPreview(str);
                        };
                        r.readAsDataURL(file);
                      }
                    }
                  }}
                />
              </div>
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
                disabled={isSubmitting}
                className="w-full bg-emerald-600 text-white font-black py-5 rounded-2xl hover:bg-emerald-700 transition-all active:scale-95 shadow-xl shadow-emerald-600/30 tracking-widest uppercase disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  editingId ? 'Save Changes' : 'Confirm Registration'
                )}
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

      {/* Blocked Action Alert Dialog (When Products Linked) */}
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

export default Companies;
