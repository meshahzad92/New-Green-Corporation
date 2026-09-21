import React, { useState, useEffect } from 'react';
import { X, Banknote, Building2, Wallet, Loader2, CheckCircle } from 'lucide-react';
import { moneyService, MoneyAccount } from '../utils/moneyApi';
import { formatAmount } from '../utils/formatters';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editAccount?: MoneyAccount | null; // if provided, we're editing
}

const AddMoneyAccountModal: React.FC<Props> = ({ isOpen, onClose, onSuccess, editAccount }) => {
  const [title, setTitle] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountType, setAccountType] = useState<'BANK' | 'CASH'>('BANK');
  const [accountNumber, setAccountNumber] = useState('');
  const [openingBalance, setOpeningBalance] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (editAccount) {
        setTitle(editAccount.title);
        setBankName(editAccount.bank_name || '');
        setAccountType(editAccount.account_type as 'BANK' | 'CASH');
        setAccountNumber(editAccount.account_number || '');
        setOpeningBalance(''); // not editable in edit mode
      } else {
        setTitle('');
        setBankName('');
        setAccountType('BANK');
        setAccountNumber('');
        setOpeningBalance('');
      }
      setError('');
      setIsSubmitting(false);
    }
  }, [isOpen, editAccount]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!title.trim()) { setError('Account title is required'); return; }

    try {
      setIsSubmitting(true);
      setError('');
      if (editAccount) {
        await moneyService.updateAccount(editAccount.id, {
          title: title.trim(),
          bank_name: bankName.trim() || undefined,
          account_type: accountType,
          account_number: accountNumber.trim() || undefined,
        });
      } else {
        await moneyService.createAccount({
          title: title.trim(),
          bank_name: bankName.trim() || undefined,
          account_type: accountType,
          account_number: accountNumber.trim() || undefined,
          opening_balance: openingBalance ? parseFloat(openingBalance) : 0,
        });
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to save account');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gradient-to-r from-blue-600/10 to-indigo-600/10 dark:from-blue-950/20 dark:to-indigo-950/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {editAccount ? 'Edit Account' : 'Add Money Account'}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {editAccount ? 'Update account details' : 'Add a bank or cash account to track'}
              </p>
            </div>
          </div>
          <button onClick={onClose} disabled={isSubmitting} className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-xl text-red-600 dark:text-red-400 text-sm font-medium">{error}</div>
          )}

          {/* Account Type Toggle */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">Account Type *</label>
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <button type="button" onClick={() => setAccountType('BANK')}
                className={`py-2.5 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition ${
                  accountType === 'BANK' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}>
                <Building2 className="w-4 h-4" /> Bank Account
              </button>
              <button type="button" onClick={() => setAccountType('CASH')}
                className={`py-2.5 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition ${
                  accountType === 'CASH' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}>
                <Wallet className="w-4 h-4" /> Cash / Counter
              </button>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">Account Title *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} required
              placeholder={accountType === 'BANK' ? 'e.g. Shahzad Spray Center' : 'e.g. Shop Counter Cash'}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-sm" />
          </div>

          {/* Bank Name (only for BANK type) */}
          {accountType === 'BANK' && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">Bank Name <span className="text-gray-400 normal-case">(Optional)</span></label>
              <input type="text" value={bankName} onChange={e => setBankName(e.target.value)}
                placeholder="e.g. UBL, HBL, Meezan Bank"
                className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-sm" />
            </div>
          )}

          {/* Account Number */}
          {accountType === 'BANK' && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">Account No. / IBAN <span className="text-gray-400 normal-case">(Optional)</span></label>
              <input type="text" value={accountNumber} onChange={e => setAccountNumber(e.target.value)}
                placeholder="e.g. PK36UNIL0109000100279773"
                className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-sm" />
            </div>
          )}

          {/* Opening Balance — only for new accounts */}
          {!editAccount && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">Opening Balance (Rs.) <span className="text-gray-400 normal-case">(Current amount in account)</span></label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">Rs.</span>
                <input type="number" step="any" min="0" value={openingBalance} onChange={e => setOpeningBalance(e.target.value)}
                  placeholder="0"
                  className="w-full pl-11 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-lg font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition" />
              </div>
              {openingBalance && parseFloat(openingBalance) > 0 && (
                <p className="mt-1 text-xs text-blue-600 dark:text-blue-400 font-semibold">Rs. {formatAmount(Number(openingBalance))} will be set as opening balance</p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-gray-100 dark:border-gray-800">
            <button type="button" onClick={onClose} disabled={isSubmitting}
              className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition">Cancel</button>
            <button type="submit" disabled={isSubmitting}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-lg transition">
              {isSubmitting ? (<><Loader2 className="w-4 h-4 animate-spin" />Saving...</>) : (<><CheckCircle className="w-4 h-4" />{editAccount ? 'Save Changes' : 'Add Account'}</>)}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddMoneyAccountModal;
