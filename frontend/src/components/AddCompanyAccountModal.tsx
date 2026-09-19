import React, { useState, useEffect } from 'react';
import { X, Building2, Phone, CheckCircle, Loader2, Link2 } from 'lucide-react';
import { companyKhataService, CompanyAccount } from '../utils/companyKhataApi';
import { useData } from '../context/DataContext';

interface AddCompanyAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newAccount: CompanyAccount) => void;
  editAccount?: CompanyAccount | null;
}

export const AddCompanyAccountModal: React.FC<AddCompanyAccountModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  editAccount
}) => {
  const { companies } = useData();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [catalogCompanyId, setCatalogCompanyId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (editAccount) {
        setName(editAccount.name);
        setPhone(editAccount.phone || '');
        setCatalogCompanyId(editAccount.catalog_company_id || '');
      } else {
        setName('');
        setPhone('');
        setCatalogCompanyId('');
      }
      setError('');
      setIsSubmitting(false);
    }
  }, [isOpen, editAccount]);

  if (!isOpen) return null;

  const handleCatalogSelect = (catId: string) => {
    setCatalogCompanyId(catId);
    if (!name.trim() && catId) {
      const selectedCat = companies.find(c => c.id === catId);
      if (selectedCat) {
        setName(selectedCat.name);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please enter a company name');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');

      let result: CompanyAccount;
      if (editAccount) {
        result = await companyKhataService.updateAccount(editAccount.id, {
          name: trimmedName,
          phone: phone.trim() || undefined,
          catalog_company_id: catalogCompanyId || undefined
        });
      } else {
        result = await companyKhataService.createAccount({
          name: trimmedName,
          phone: phone.trim() || undefined,
          catalog_company_id: catalogCompanyId || undefined
        });
      }

      onSuccess(result);
      onClose();
    } catch (err: any) {
      console.error('Failed to save company account:', err);
      setError(err?.response?.data?.detail || 'Failed to save company account. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gradient-to-r from-emerald-600/10 to-teal-600/10 dark:from-emerald-950/20 dark:to-teal-950/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {editAccount ? 'Edit Company Account' : 'Add Company to Khata'}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {editAccount ? 'Update supplier ledger details' : 'Track advances and stock with this supplier'}
              </p>
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-xl text-red-600 dark:text-red-400 text-sm font-medium">
              {error}
            </div>
          )}

          {/* Link to Catalog Company (Optional) */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Link2 className="w-3.5 h-3.5 text-emerald-600" />
              Link to Catalog Company <span className="text-gray-400 normal-case">(For Product Inward)</span>
            </label>
            <select
              value={catalogCompanyId}
              onChange={(e) => handleCatalogSelect(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition text-sm"
            >
              <option value="">-- None (Standalone Supplier) --</option>
              {companies.map((comp) => (
                <option key={comp.id} value={comp.id}>
                  {comp.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-gray-400">
              Linking allows you to pick this company's products directly when receiving stock.
            </p>
          </div>

          {/* Company Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
              Company / Supplier Name *
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Bayer Pakistan, Syngenta, FMC"
                required
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
              />
            </div>
          </div>

          {/* Phone Number */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
              Contact / Phone Number <span className="text-gray-400 normal-case">(Optional)</span>
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 0300-1234567"
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
              />
            </div>
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
              disabled={isSubmitting}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-lg shadow-emerald-600/20 transition"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  {editAccount ? 'Save Changes' : 'Add Company'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddCompanyAccountModal;
