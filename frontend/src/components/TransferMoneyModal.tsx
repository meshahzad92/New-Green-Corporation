import React, { useState, useEffect } from 'react';
import { X, Building2, User, Send, Loader2, ArrowRight } from 'lucide-react';
import { moneyService, MoneyAccount } from '../utils/moneyApi';
import { companyKhataService, CompanyAccount } from '../utils/companyKhataApi';
import CustomDatePicker from './CustomDatePicker';
import { formatAmount } from '../utils/formatters';

interface TransferMoneyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preselectedAccountId?: string;
}

const TransferMoneyModal: React.FC<TransferMoneyModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  preselectedAccountId,
}) => {
  const [transferToType, setTransferToType] = useState<'COMPANY' | 'PERSON'>('COMPANY');
  const [accounts, setAccounts] = useState<MoneyAccount[]>([]);
  const [companyAccounts, setCompanyAccounts] = useState<CompanyAccount[]>([]);
  
  const [selectedAccountId, setSelectedAccountId] = useState(preselectedAccountId || '');
  const [selectedCompanyKhataId, setSelectedCompanyKhataId] = useState('');
  const [personName, setPersonName] = useState('');
  const [personAccount, setPersonAccount] = useState('');
  
  const [amount, setAmount] = useState('');
  const [transferDate, setTransferDate] = useState<Date>(new Date());
  const [tid, setTid] = useState('');
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'ONLINE' | 'CASH'>('ONLINE');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setError('');
      setAmount('');
      setTid('');
      setDescription('');
      setPersonName('');
      setPersonAccount('');
      setSelectedCompanyKhataId('');
      setTransferDate(new Date());

      // Load money accounts and company khata accounts
      moneyService.getAccounts().then(accs => {
        setAccounts(accs);
        if (preselectedAccountId) {
          setSelectedAccountId(preselectedAccountId);
        } else if (accs.length > 0) {
          setSelectedAccountId(accs[0].id);
        }
      }).catch(() => {});

      companyKhataService.getAccounts().then(coAccs => {
        setCompanyAccounts(coAccs);
        if (coAccs.length > 0) {
          setSelectedCompanyKhataId(coAccs[0].id);
        }
      }).catch(() => {});
    }
  }, [isOpen, preselectedAccountId]);

  if (!isOpen) return null;

  const currentAccount = accounts.find(a => a.id === selectedAccountId);
  const selectedCompany = companyAccounts.find(c => c.id === selectedCompanyKhataId);
  const numericAmount = parseFloat(amount) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!selectedAccountId) {
      setError('Please select a Money Account');
      return;
    }

    if (numericAmount <= 0) {
      setError('Amount must be greater than 0');
      return;
    }

    if (transferToType === 'COMPANY' && !selectedCompanyKhataId) {
      setError('Please select a company to transfer to');
      return;
    }

    if (transferToType === 'PERSON' && !personName.trim()) {
      setError('Person name is required');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');

      await moneyService.createTransfer({
        account_id: selectedAccountId,
        transfer_to_type: transferToType,
        company_khata_account_id: transferToType === 'COMPANY' ? selectedCompanyKhataId : undefined,
        person_name: transferToType === 'PERSON' ? personName.trim() : undefined,
        person_account: transferToType === 'PERSON' ? personAccount.trim() : undefined,
        amount: numericAmount,
        transaction_date: transferDate.toISOString(),
        payment_method: paymentMethod,
        tid: tid.trim() || undefined,
        description: description.trim() || undefined,
      });

      onSuccess();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to complete transfer');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold">Money Transfer</h2>
              <p className="text-xs text-purple-100">Transfer funds to a Company or Person</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-purple-100 hover:text-white hover:bg-white/10 rounded-xl transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-3.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-2xl text-xs font-semibold text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Transfer Type Tab Switch */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Transfer To
            </label>
            <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-2xl">
              <button
                type="button"
                onClick={() => setTransferToType('COMPANY')}
                className={`py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                  transferToType === 'COMPANY'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Building2 className="w-4 h-4" /> Company / Supplier
              </button>
              <button
                type="button"
                onClick={() => setTransferToType('PERSON')}
                className={`py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                  transferToType === 'PERSON'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <User className="w-4 h-4" /> Individual Person
              </button>
            </div>
          </div>

          {/* Money Account Selection */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              From Money Account *
            </label>
            <select
              value={selectedAccountId}
              onChange={e => setSelectedAccountId(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
            >
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.title} ({acc.bank_name || acc.account_type}) — Rs. {formatAmount(acc.current_balance)}
                </option>
              ))}
            </select>
          </div>

          {/* Company Selection Mode */}
          {transferToType === 'COMPANY' ? (
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Select Target Company *
              </label>
              {companyAccounts.length === 0 ? (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 text-xs text-amber-700 dark:text-amber-400 rounded-2xl">
                  No Company Khata accounts found. Please add a company in Company Khata first.
                </div>
              ) : (
                <select
                  value={selectedCompanyKhataId}
                  onChange={e => setSelectedCompanyKhataId(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
                >
                  {companyAccounts.map(co => (
                    <option key={co.id} value={co.id}>
                      🏢 {co.name} {co.phone ? `(${co.phone})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : (
            /* Person Selection Mode */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Person Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ali Raza"
                  value={personName}
                  onChange={e => setPersonName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Account Name / Details (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. UBL - 03920..."
                  value={personAccount}
                  onChange={e => setPersonAccount(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>
            </div>
          )}

          {/* Amount & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Amount (Rs.) *
              </label>
              <input
                type="number"
                step="any"
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-extrabold text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Transfer Date *
              </label>
              <CustomDatePicker
                selectedDate={transferDate}
                onChange={date => setTransferDate(date || new Date())}
                maxDate={new Date()}
              />
            </div>
          </div>

          {/* TID & Payment Method */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Transaction ID / TID (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. TRX-938210"
                value={tid}
                onChange={e => setTid(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-mono font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value as any)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
              >
                <option value="ONLINE">ONLINE / Bank Transfer</option>
                <option value="CASH">CASH</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Description / Notes (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Payment for stock refill..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
            />
          </div>

          {/* Summary Preview */}
          {numericAmount > 0 && (
            <div className="p-4 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/40 rounded-2xl flex items-center justify-between">
              <div>
                <p className="text-xs text-purple-600 dark:text-purple-400 font-bold uppercase tracking-wider">Transfer Summary</p>
                <p className="text-sm font-black text-purple-900 dark:text-purple-200 mt-0.5">
                  Rs. {formatAmount(numericAmount)}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  {currentAccount?.title} <ArrowRight className="w-3 h-3 inline mx-1 text-purple-500" />{' '}
                  {transferToType === 'COMPANY' ? (selectedCompany?.name || 'Company') : (personName || 'Person')}
                </p>
              </div>
              <span className="px-3 py-1 bg-purple-600 text-white text-xs font-extrabold rounded-xl">
                - Rs. {formatAmount(numericAmount)}
              </span>
            </div>
          )}

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-3 text-xs font-extrabold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-extrabold rounded-2xl transition shadow-lg shadow-purple-500/25 flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Transferring...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" /> Confirm Transfer
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TransferMoneyModal;
